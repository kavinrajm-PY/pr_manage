'use client';

// src/app/tasks/[taskId]/TaskDetailClient.tsx
// Client component implementation of the Task Details page.

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/AuthContext';
import { getTaskById, updateTaskStatus, updateTask, deleteTask } from '@/services/tasks';
import { getProjectById } from '@/services/projects';
import { getUserById, getUsersByIds } from '@/services/users';
import { isProjectMember, getProjectMembers } from '@/services/projectMembers';
import { getCommentsByTask, addComment } from '@/services/comments';
import { createNotification } from '@/services/notifications';
import { Task, Project, User, Comment, TaskStatus } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { PriorityBadge } from '@/components/ui/priority-badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatDate, formatDateFull, isOverdue, formatDateWithTime } from '@/lib/utils/dates';
import { ArrowLeft, MessageSquare, AlertCircle, ShieldAlert, Send, UserCheck, Trash2, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function TaskDetailClient() {
  const params = useParams();
  const taskId = params.taskId as string;
  const { role, firebaseUser, userProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [assignee, setAssignee] = useState<User | null>(null);
  const [creator, setCreator] = useState<User | null>(null);
  const [comments, setComments] = useState<(Comment & { authorName: string })[]>([]);
  const [authorized, setAuthorized] = useState(false);

  // Status/Comment states
  const [status, setStatus] = useState<TaskStatus>('TODO');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Reassign state (Team Lead only)
  const [projectMembers, setProjectMembers] = useState<User[]>([]);
  const [reassignTo, setReassignTo] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // Completion % state (Team Member only)
  const [completionPercent, setCompletionPercent] = useState(0);
  const [savingProgress, setSavingProgress] = useState(false);

  // Delete task state (Team Lead only)
  const [confirmDeleteTask, setConfirmDeleteTask] = useState(false);
  const [deletingTask, setDeletingTask] = useState(false);

  useEffect(() => {
    async function loadTaskDetails() {
      if (!taskId || !firebaseUser || !role) return;

      try {
        // 1. Fetch Task
        const taskData = await getTaskById(taskId);
        if (!taskData) {
          toast({
            title: 'Not Found',
            description: 'Task does not exist.',
            variant: 'destructive',
          });
          router.push('/dashboard');
          return;
        }

        // 2. Access Authorization Check
        let isAuthorized = false;

        if (role === 'PROJECT_MANAGER') {
          isAuthorized = true;
        } else if (role === 'TEAM_LEAD') {
          isAuthorized = await isProjectMember(taskData.projectId, firebaseUser.uid);
        } else if (role === 'TEAM_MEMBER') {
          isAuthorized = taskData.assignedTo === firebaseUser.uid;
        }

        if (!isAuthorized) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        setAuthorized(true);
        setTask(taskData);
        setStatus(taskData.status);
        setCompletionPercent(taskData.completionPercent ?? 0);

        // 3. Fetch related details (Project, Assignee, Creator, Comments)
        const [projectData, assigneeData, creatorData, taskComments] = await Promise.all([
          getProjectById(taskData.projectId),
          getUserById(taskData.assignedTo),
          getUserById(taskData.createdBy),
          getCommentsByTask(taskData.id),
        ]);

        setProject(projectData);
        setAssignee(assigneeData);
        setCreator(creatorData);

        // 4a. Load project members for reassign (Team Lead only — active members and leads)
        if (role === 'TEAM_LEAD' && projectData) {
          const memberships = await getProjectMembers(taskData.projectId);
          const memberUids = memberships
            .filter((m) => m.role === 'TEAM_MEMBER' || m.role === 'TEAM_LEAD')
            .map((m) => m.userId);
          const members = await getUsersByIds(memberUids);
          setProjectMembers(members.filter((u) => u.isActive !== false));
          setReassignTo(taskData.assignedTo); // pre-select current assignee
        }

        // 4. Enrich comments with author names
        const commentAuthorIds = Array.from(new Set(taskComments.map((c) => c.userId)));
        const authors = await getUsersByIds(commentAuthorIds);

        const enrichedComments = taskComments.map((comment) => {
          const author = authors.find((u) => u.id === comment.userId);
          return {
            ...comment,
            authorName: author ? author.name : 'Unknown User',
          };
        });

        setComments(enrichedComments);
      } catch (error) {
        console.error('Failed to load task details', error);
      } finally {
        setLoading(false);
      }
    }

    loadTaskDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, firebaseUser, role, router]);

  // Handle task reassignment (Team Lead only)
  async function handleReassign() {
    if (!task || !firebaseUser || !reassignTo || reassignTo === task.assignedTo) return;
    setReassigning(true);
    try {
      await updateTask(task.id, { assignedTo: reassignTo }, firebaseUser.uid);

      // Update local state immediately
      const newAssignee = projectMembers.find((m) => m.id === reassignTo) || null;
      setAssignee(newAssignee);
      setTask({ ...task, assignedTo: reassignTo });

      // Notify new assignee
      createNotification({
        userId: reassignTo,
        type: 'TASK_ASSIGNED',
        title: 'Task Reassigned to You',
        message: `The task "${task.title}" has been reassigned to you by your Team Lead.`,
        link: `/tasks/${task.id}`,
      }).catch(console.error);

      toast({ title: 'Assignee Updated', description: `Task reassigned to ${newAssignee?.name ?? 'new member'}.` });
    } catch (error: any) {
      console.error('Failed to reassign task', error);
      toast({ title: 'Error', description: error.message || 'Failed to reassign task.', variant: 'destructive' });
    } finally {
      setReassigning(false);
    }
  }

  // Save task completion percentage (Team Member only)
  async function handleSaveProgress() {
    if (!task || !firebaseUser) return;
    setSavingProgress(true);
    try {
      await updateTask(task.id, { completionPercent }, firebaseUser.uid);
      setTask({ ...task, completionPercent });
      toast({ title: 'Progress Saved', description: `Task is ${completionPercent}% complete.` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save progress.', variant: 'destructive' });
    } finally {
      setSavingProgress(false);
    }
  }

  // Delete task (Team Lead only)
  async function handleDeleteTask() {
    if (!task) return;
    setDeletingTask(true);
    try {
      await deleteTask(task.id);
      toast({ title: 'Task Deleted', description: `"${task.title}" has been deleted.` });
      router.push(role === 'TEAM_LEAD' ? `/lead/projects/${task.projectId}` : `/projects/${task.projectId}`);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete task.', variant: 'destructive' });
      setDeletingTask(false);
      setConfirmDeleteTask(false);
    }
  }

  // Handle task status update
  async function handleStatusChange(newStatus: TaskStatus) {
    if (!task || !firebaseUser) return;
    setUpdatingStatus(true);
    try {
      await updateTaskStatus(task.id, newStatus, firebaseUser.uid);
      setStatus(newStatus);

      // Trigger status notifications
      const updaterName = userProfile?.name || firebaseUser?.email || 'Someone';
      const notifyPromises: Promise<any>[] = [];

      if (role === 'TEAM_MEMBER') {
        // Notify Team Lead (task creator)
        if (task.createdBy && task.createdBy !== firebaseUser.uid) {
          notifyPromises.push(
            createNotification({
              userId: task.createdBy,
              type: 'STATUS_UPDATED',
              title: 'Task Status Updated',
              message: `"${task.title}" status was updated to "${newStatus}" by ${updaterName}.`,
              link: `/tasks/${task.id}`,
            })
          );
        }
        // Notify Project Manager (project creator)
        if (project?.createdBy && project.createdBy !== firebaseUser.uid && project.createdBy !== task.createdBy) {
          notifyPromises.push(
            createNotification({
              userId: project.createdBy,
              type: 'STATUS_UPDATED',
              title: 'Task Status Updated',
              message: `"${task.title}" status was updated to "${newStatus}" by ${updaterName}.`,
              link: `/tasks/${task.id}`,
            })
          );
        }
      } else if (role === 'TEAM_LEAD') {
        // Notify Team Member (assignee)
        if (task.assignedTo && task.assignedTo !== firebaseUser.uid) {
          notifyPromises.push(
            createNotification({
              userId: task.assignedTo,
              type: 'STATUS_UPDATED',
              title: 'Task Status Updated',
              message: `Team Lead ${updaterName} updated task "${task.title}" to "${newStatus}".`,
              link: `/tasks/${task.id}`,
            })
          );
        }
      }

      Promise.all(notifyPromises).catch((err) =>
        console.error('Failed to trigger status change notifications', err)
      );

      toast({
        title: 'Status Updated',
        description: `Task status changed to ${newStatus}.`,
      });
    } catch (error) {
      console.error('Failed to update status', error);
      toast({
        title: 'Error',
        description: 'Failed to update task status.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingStatus(false);
    }
  }

  // Handle comment submit
  async function handleCommentSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || !task || !firebaseUser) return;

    setSubmittingComment(true);
    try {
      const added = await addComment({
        taskId: task.id,
        userId: firebaseUser.uid,
        comment: newComment.trim(),
      });

      // Enrich locally
      const currentUserProfile = await getUserById(firebaseUser.uid);
      const commenterName = currentUserProfile ? currentUserProfile.name : 'Someone';
      const enriched: Comment & { authorName: string } = {
        ...added,
        authorName: commenterName,
      };

      setComments((prev) => [...prev, enriched]);
      setNewComment('');

      // Send Comment Notifications
      const notifyPromises: Promise<any>[] = [];
      const commentSnippet = newComment.trim().length > 60
        ? `${newComment.trim().slice(0, 60)}...`
        : newComment.trim();

      if (role === 'TEAM_MEMBER') {
        // Notify Team Lead (task creator)
        if (task.createdBy && task.createdBy !== firebaseUser.uid) {
          notifyPromises.push(
            createNotification({
              userId: task.createdBy,
              type: 'COMMENT_ADDED',
              title: `Comment on "${task.title}"`,
              message: `${commenterName} commented: "${commentSnippet}"`,
              link: `/tasks/${task.id}`,
            })
          );
        }
        // Notify PM (project owner)
        if (project?.createdBy && project.createdBy !== firebaseUser.uid && project.createdBy !== task.createdBy) {
          notifyPromises.push(
            createNotification({
              userId: project.createdBy,
              type: 'COMMENT_ADDED',
              title: `Comment on "${task.title}"`,
              message: `${commenterName} commented: "${commentSnippet}"`,
              link: `/tasks/${task.id}`,
            })
          );
        }
      } else if (role === 'TEAM_LEAD') {
        // Notify Team Member (assignee)
        if (task.assignedTo && task.assignedTo !== firebaseUser.uid) {
          notifyPromises.push(
            createNotification({
              userId: task.assignedTo,
              type: 'COMMENT_ADDED',
              title: `Comment on "${task.title}"`,
              message: `Team Lead ${commenterName} commented: "${commentSnippet}"`,
              link: `/tasks/${task.id}`,
            })
          );
        }
      } else if (role === 'PROJECT_MANAGER') {
        // PM commented: notify both Team Lead and Assignee
        if (task.createdBy && task.createdBy !== firebaseUser.uid) {
          notifyPromises.push(
            createNotification({
              userId: task.createdBy,
              type: 'COMMENT_ADDED',
              title: `Comment on "${task.title}"`,
              message: `PM ${commenterName} commented: "${commentSnippet}"`,
              link: `/tasks/${task.id}`,
            })
          );
        }
        if (task.assignedTo && task.assignedTo !== firebaseUser.uid && task.assignedTo !== task.createdBy) {
          notifyPromises.push(
            createNotification({
              userId: task.assignedTo,
              type: 'COMMENT_ADDED',
              title: `Comment on "${task.title}"`,
              message: `PM ${commenterName} commented: "${commentSnippet}"`,
              link: `/tasks/${task.id}`,
            })
          );
        }
      }

      Promise.all(notifyPromises).catch((err) =>
        console.error('Failed to send comment notifications', err)
      );

      toast({
        title: 'Comment Added',
        description: 'Your comment has been posted.',
      });
    } catch (error) {
      console.error('Failed to add comment', error);
      toast({
        title: 'Error',
        description: 'Failed to post comment.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingComment(false);
    }
  }

  // Determine back navigation link
  const getBackLink = () => {
    if (role === 'PROJECT_MANAGER') return `/projects/${task?.projectId}`;
    if (role === 'TEAM_LEAD') return `/lead/projects/${task?.projectId}`;
    return '/member/tasks';
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!authorized || !task) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-2">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">
            You do not have permission to view this task, or the task does not exist.
          </p>
        </div>
      </AppLayout>
    );
  }

  const isTaskOverdue = isOverdue(task);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          href={getBackLink()}
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:underline text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 space-y-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  Project: {project ? project.name : '...'}
                </span>
                <div className="flex gap-2">
                  <PriorityBadge priority={task.priority} />
                  <StatusBadge status={status} />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">{task.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">Description</h3>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {task.description || 'No description provided.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4 text-xs">
                <div>
                  <span className="text-muted-foreground block uppercase font-medium mb-0.5">Assigned To</span>
                  <span className="font-semibold text-sm">{assignee ? assignee.name : 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block uppercase font-medium mb-0.5">Created By</span>
                  <span className="font-semibold text-sm">{creator ? creator.name : 'System'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block uppercase font-medium mb-0.5">Created Date</span>
                  <span className="font-semibold text-sm">{formatDateFull(task.createdAt)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block uppercase font-medium mb-0.5">Deadline</span>
                  <span className={`font-semibold text-sm flex items-center gap-1.5 ${isTaskOverdue ? 'text-rose-600' : ''}`}>
                    {isTaskOverdue && <AlertCircle className="h-3.5 w-3.5" />}
                    {formatDateFull(task.deadline)}
                  </span>
                </div>

                {/* Completion % — full-width row, visible to ALL roles */}
                <div className="col-span-2 pt-2 border-t">
                  <span className="text-muted-foreground block uppercase font-medium mb-2">Task Completion Progress</span>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${task.status === 'COMPLETED' ? 100 : (task.completionPercent ?? 0)}%`,
                          background: task.status === 'COMPLETED'
                            ? '#22c55e'
                            : 'linear-gradient(90deg, #7c4d96, #a855f7)',
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold text-primary w-10 text-right">
                      {task.status === 'COMPLETED' ? 100 : (task.completionPercent ?? 0)}%
                    </span>
                  </div>
                  {role !== 'TEAM_MEMBER' && task.completionPercent > 0 && task.status !== 'COMPLETED' && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Self-reported by assignee
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Actions</CardTitle>
              <CardDescription>Update task details and progress</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-status" className="text-xs font-semibold text-muted-foreground uppercase">
                  Status
                </Label>
                {role === 'PROJECT_MANAGER' ? (
                  <div className="pt-1">
                    <StatusBadge status={status} />
                  </div>
                ) : (
                  <Select
                    value={status}
                    onValueChange={(val) => handleStatusChange(val as TaskStatus)}
                    disabled={updatingStatus}
                  >
                    <SelectTrigger id="task-status">
                      <SelectValue placeholder="Update status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODO">To Do</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="BLOCKED">Blocked</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* ── Reassign Assignee (Team Lead only) ──────────────────────────── */}
              {role === 'TEAM_LEAD' && projectMembers.length > 0 && (
                <div className="space-y-2 pt-3 border-t">
                  <Label htmlFor="reassign-select" className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5" /> Reassign To
                  </Label>
                  <select
                    id="reassign-select"
                    value={reassignTo}
                    onChange={(e) => setReassignTo(e.target.value)}
                    disabled={reassigning}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {projectMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={handleReassign}
                    disabled={reassigning || !reassignTo || reassignTo === task?.assignedTo}
                  >
                    <UserCheck className="h-4 w-4" />
                    {reassigning ? 'Saving...' : 'Save Reassignment'}
                  </Button>
                </div>
              )}

              {/* ── Completion % slider (Team Member or assigned Team Lead, IN_PROGRESS only) ── */}
              {(role === 'TEAM_MEMBER' || (role === 'TEAM_LEAD' && task.assignedTo === firebaseUser?.uid)) && status === 'IN_PROGRESS' && (
                <div className="space-y-3 pt-3 border-t">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" /> Completion Progress
                  </Label>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">0%</span>
                      <span className="font-bold text-primary text-lg">{completionPercent}%</span>
                      <span className="text-muted-foreground">100%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={completionPercent}
                      onChange={(e) => setCompletionPercent(Number(e.target.value))}
                      className="w-full h-2 rounded-full accent-primary cursor-pointer"
                    />
                    {/* Progress bar preview */}
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${completionPercent}%`,
                          background: completionPercent === 100 ? '#22c55e' : 'linear-gradient(90deg, #7c4d96, #a855f7)',
                        }}
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={handleSaveProgress}
                    disabled={savingProgress || completionPercent === (task?.completionPercent ?? 0)}
                  >
                    {savingProgress ? 'Saving…' : 'Save Progress'}
                  </Button>
                </div>
              )}

              {/* ── Delete Task (Team Lead only) ─────────────────────────────────── */}
              {role === 'TEAM_LEAD' && (
                <div className="pt-3 border-t">
                  {!confirmDeleteTask ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
                      onClick={() => setConfirmDeleteTask(true)}
                    >
                      <Trash2 className="h-4 w-4" /> Delete Task
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-destructive font-semibold text-center">Are you sure? This cannot be undone.</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" className="flex-1" onClick={handleDeleteTask} disabled={deletingTask}>
                          {deletingTask ? 'Deleting…' : 'Yes, Delete'}
                        </Button>
                        <Button size="sm" variant="ghost" className="flex-1" onClick={() => setConfirmDeleteTask(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MessageSquare className="h-4.5 w-4.5 text-primary" /> Comments ({comments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {comments.map((c) => (
                <div key={c.id} className="text-sm p-3 rounded-md bg-muted/30 border">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-foreground">{c.authorName}</span>
                    <span className="text-xs text-muted-foreground">{formatDateWithTime(c.createdAt)}</span>
                  </div>
                  <p className="text-muted-foreground whitespace-pre-wrap">{c.comment}</p>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No comments posted on this task yet.
                </p>
              )}
            </div>

            {role !== 'PROJECT_MANAGER' && (
              <form onSubmit={handleCommentSubmit} className="flex gap-2 pt-4 border-t">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  disabled={submittingComment}
                  required
                />
                <Button type="submit" size="icon" disabled={submittingComment || !newComment.trim()}>
                  <Send className="h-4 w-4" />
                  <span className="sr-only">Add comment</span>
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
