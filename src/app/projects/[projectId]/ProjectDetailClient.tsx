'use client';

// src/app/projects/[projectId]/ProjectDetailClient.tsx
// PM only Individual Project Dashboard client layout.

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/AuthContext';
import { getProjectById, updateProject, deleteProject } from '@/services/projects';
import { getProjectMembers } from '@/services/projectMembers';
import { getTasksByProject } from '@/services/tasks';
import { getUserById, getUsersByIds } from '@/services/users';
import { Project, User, Task, TaskWithUsers, ProjectStatus } from '@/types';
import { StatCard } from '@/components/ui/stat-card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusBadge } from '@/components/ui/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { isOverdue, isCompletedOnTime, isCompletedLate, formatDate, calcProgress, daysUntilDeadline } from '@/lib/utils/dates';
import { FolderKanban, Users, Calendar, AlertCircle, Ban, Clock, CheckCircle2, ShieldAlert, Trash2 } from 'lucide-react';
import { ManageTeamDialog } from '@/components/projects/ManageTeamDialog';
import { TaskList } from '@/components/tasks/TaskList';
import Link from 'next/link';

export default function ProjectDetailClient() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { role } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [teamLead, setTeamLead] = useState<User | null>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<TaskWithUsers[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [deletingProject, setDeletingProject] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1);

  useEffect(() => {
    if (!loading && role !== 'PROJECT_MANAGER') {
      router.push('/login');
    }
  }, [role, loading, router]);

  useEffect(() => {
    async function loadProjectData() {
      if (!projectId) return;
      try {
        const projectData = await getProjectById(projectId);
        if (!projectData) {
          toast({
            title: 'Not Found',
            description: 'Project could not be found.',
            variant: 'destructive',
          });
          router.push('/dashboard');
          return;
        }
        setProject(projectData);

        const [memberships, rawTasks] = await Promise.all([
          getProjectMembers(projectId),
          getTasksByProject(projectId),
        ]);

        const uids = memberships.map((m) => m.userId);
        const users = await getUsersByIds(uids);

        let leadProfile: User | null = null;
        const membersProfiles: User[] = [];

        memberships.forEach((m) => {
          const user = users.find((u) => u.id === m.userId);
          if (user) {
            if (m.role === 'TEAM_LEAD') {
              leadProfile = user;
            } else if (m.role === 'TEAM_MEMBER') {
              membersProfiles.push(user);
            }
          }
        });

        setTeamLead(leadProfile);
        setTeamMembers(membersProfiles);

        const enrichedTasks = rawTasks.map((task) => {
          const assignee = users.find((u) => u.id === task.assignedTo) || null;
          const creator = users.find((u) => u.id === task.createdBy) || null;
          return {
            ...task,
            assignedToUser: assignee,
            createdByUser: creator,
          };
        });

        setTasks(enrichedTasks);
      } catch (error) {
        console.error('Error loading project dashboard', error);
      } finally {
        setLoading(false);
      }
    }

    if (role === 'PROJECT_MANAGER') {
      loadProjectData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, role, router, refreshTrigger]);

  const totalTasksCount = tasks.length;
  const completedTasksCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const inProgressTasksCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const todoTasksCount = tasks.filter((t) => t.status === 'TODO').length;
  const blockedTasksCount = tasks.filter((t) => t.status === 'BLOCKED').length;
  const overdueTasksCount = tasks.filter((t) => isOverdue(t)).length;

  const progressPercent = calcProgress(totalTasksCount, completedTasksCount);

  const completedOnTime = tasks.filter((t) => isCompletedOnTime(t)).length;
  const completedLate = tasks.filter((t) => isCompletedLate(t)).length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingDeadlines = tasks
    .filter((t) => {
      const deadlineDate = new Date(t.deadline);
      deadlineDate.setHours(0, 0, 0, 0);
      return t.status !== 'COMPLETED' && deadlineDate >= today;
    })
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5);

  const overdueTasksList = tasks
    .filter((t) => {
      const deadlineDate = new Date(t.deadline);
      deadlineDate.setHours(0, 0, 0, 0);
      return t.status !== 'COMPLETED' && deadlineDate < today;
    })
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  const blockedTasksList = tasks.filter((t) => t.status === 'BLOCKED');

  async function handleStatusChange(newStatus: ProjectStatus) {
    if (!project) return;
    setUpdatingStatus(true);
    try {
      await updateProject(project.id, { status: newStatus });
      setProject({
        ...project,
        status: newStatus,
      });
      toast({
        title: 'Project Status Updated',
        description: `Project status set to ${newStatus.replace('_', ' ')}.`,
      });
    } catch (error) {
      console.error('Failed to update project status', error);
      toast({
        title: 'Error',
        description: 'Failed to update project status.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (role !== 'PROJECT_MANAGER' || !project) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-2">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">Only Project Managers can access this page.</p>
        </div>
      </AppLayout>
    );
  }

  async function handleDeleteProject() {
    if (!project) return;
    setDeletingProject(true);
    try {
      await deleteProject(project.id);
      toast({ title: 'Project Deleted', description: `"${project.name}" has been deleted.` });
      router.push('/dashboard');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete project.', variant: 'destructive' });
      setDeletingProject(false);
      setConfirmDelete(false);
    }
  }

  const todoPercentage = totalTasksCount > 0 ? Math.round((todoTasksCount / totalTasksCount) * 100) : 0;
  const progressPercentage = totalTasksCount > 0 ? Math.round((inProgressTasksCount / totalTasksCount) * 100) : 0;
  const blockedPercentage = totalTasksCount > 0 ? Math.round((blockedTasksCount / totalTasksCount) * 100) : 0;
  const completedPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link href="/dashboard" className="text-muted-foreground hover:underline text-sm font-medium">
                Projects
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">{project.name}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <p className="text-muted-foreground max-w-2xl">{project.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="project-status-select" className="text-xs font-semibold text-muted-foreground uppercase">
              Project Status
            </Label>
            <Select
              value={project.status}
              onValueChange={(val) => handleStatusChange(val as ProjectStatus)}
              disabled={updatingStatus}
            >
              <SelectTrigger id="project-status-select" className="w-[180px]">
                <SelectValue placeholder="Project Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="ON_HOLD">On Hold</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>

            {/* ── Delete Project ── */}
            {!confirmDelete ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" /> Delete Project
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-destructive font-semibold">Confirm delete?</span>
                <Button size="sm" variant="destructive" onClick={handleDeleteProject} disabled={deletingProject}>
                  {deletingProject ? 'Deleting…' : 'Yes, Delete'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Project Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground block">START DATE</span>
                <span className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {formatDate(project.startDate)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground block">DEADLINE</span>
                <span className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {formatDate(project.deadline)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground block">DAYS LEFT</span>
                <span className={`text-sm font-semibold ${daysUntilDeadline(project.deadline) < 0 ? 'text-rose-600' : ''}`}>
                  {daysUntilDeadline(project.deadline)} days
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground block">STATUS</span>
                <StatusBadge status={project.status} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" /> Team Assignments
              </CardTitle>
              <ManageTeamDialog
                project={project}
                currentLead={teamLead}
                currentMembers={teamMembers}
                onTeamUpdated={triggerRefresh}
              />
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">TEAM LEAD</span>
                <p className="font-semibold">{teamLead ? teamLead.name : 'No lead assigned'}</p>
                <p className="text-xs text-muted-foreground">{teamLead?.email}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">TEAM MEMBERS ({teamMembers.length})</span>
                <div className="max-h-24 overflow-y-auto space-y-1.5 pr-2">
                  {teamMembers.map((m) => (
                    <div key={m.id} className="flex justify-between items-center text-xs">
                      <span className="font-medium text-foreground">{m.name}</span>
                      <span className="text-muted-foreground truncate max-w-[150px]">{m.email}</span>
                    </div>
                  ))}
                  {teamMembers.length === 0 && (
                    <span className="text-xs text-muted-foreground">No members assigned.</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Total Tasks" value={totalTasksCount} />
          <StatCard title="To Do" value={todoTasksCount} />
          <StatCard title="In Progress" value={inProgressTasksCount} />
          <StatCard title="Completed" value={completedTasksCount} />
          <StatCard title="Blocked" value={blockedTasksCount} className={blockedTasksCount > 0 ? 'border-rose-200 bg-rose-50/20' : ''} />
          <StatCard title="Overdue" value={overdueTasksCount} className={overdueTasksCount > 0 ? 'border-amber-200 bg-amber-50/20' : ''} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Completion Statistics</CardTitle>
              <CardDescription>Metrics on task speed and timely task completions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-semibold">
                  <span>Project Progress</span>
                  <span>{progressPercent}%</span>
                </div>
                <ProgressBar value={progressPercent} showText={false} />
              </div>

              <div className="grid grid-cols-3 gap-4 border-t pt-4 text-center">
                <div>
                  <span className="text-2xl font-bold text-emerald-600">{completedOnTime}</span>
                  <p className="text-xs text-muted-foreground mt-1">Completed On Time</p>
                </div>
                <div>
                  <span className="text-2xl font-bold text-amber-600">{completedLate}</span>
                  <p className="text-xs text-muted-foreground mt-1">Completed Late</p>
                </div>
                <div>
                  <span className="text-2xl font-bold text-rose-600">{overdueTasksCount}</span>
                  <p className="text-xs text-muted-foreground mt-1">Currently Overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Task Status Distribution</CardTitle>
              <CardDescription>Ratio of task categories for the project</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">To Do ({todoTasksCount})</span>
                    <span>{todoPercentage}%</span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div className="bg-slate-400 h-full rounded-full" style={{ width: `${todoPercentage}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-blue-700 dark:text-blue-400">In Progress ({inProgressTasksCount})</span>
                    <span>{progressPercentage}%</span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${progressPercentage}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-rose-700 dark:text-rose-400">Blocked ({blockedTasksCount})</span>
                    <span>{blockedPercentage}%</span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full rounded-full" style={{ width: `${blockedPercentage}%` }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">Completed ({completedTasksCount})</span>
                    <span>{completedPercentage}%</span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${completedPercentage}%` }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Deadlines */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4.5 w-4.5 text-amber-500" /> Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead className="text-right">Deadline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingDeadlines.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">
                        <Link href={`/tasks/${task.id}`} className="hover:underline hover:text-primary">
                          {task.title}
                        </Link>
                      </TableCell>
                      <TableCell>{task.assignedToUser ? task.assignedToUser.name : 'Unassigned'}</TableCell>
                      <TableCell className="text-right">
                        {formatDate(task.deadline)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {upcomingDeadlines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                        No active upcoming deadlines.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Overdue Tasks */}
          <Card className="border-rose-200 dark:border-rose-900/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4.5 w-4.5 text-rose-500" /> Overdue Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead className="text-right">Deadline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueTasksList.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">
                        <Link href={`/tasks/${task.id}`} className="hover:underline text-rose-700 hover:text-rose-600 dark:text-rose-400">
                          {task.title}
                        </Link>
                      </TableCell>
                      <TableCell>{task.assignedToUser ? task.assignedToUser.name : 'Unassigned'}</TableCell>
                      <TableCell className="text-right text-rose-600 font-bold">
                        {formatDate(task.deadline)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {overdueTasksList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                        No overdue tasks!
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Blocked Tasks */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Ban className="h-4.5 w-4.5 text-rose-500" /> Blocked Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Assigned Employee</TableHead>
                    <TableHead className="text-right">Deadline</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedTasksList.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">
                        <Link href={`/tasks/${task.id}`} className="hover:underline hover:text-primary">
                          {task.title}
                        </Link>
                      </TableCell>
                      <TableCell>{task.assignedToUser ? task.assignedToUser.name : 'Unassigned'}</TableCell>
                      <TableCell className="text-right">{formatDate(task.deadline)}</TableCell>
                    </TableRow>
                  ))}
                  {blockedTasksList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                        No blocked tasks reported.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* All Project Tasks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FolderKanban className="h-4.5 w-4.5 text-primary" /> All Project Tasks
            </CardTitle>
            <CardDescription>Comprehensive list of all tasks assigned under this project</CardDescription>
          </CardHeader>
          <CardContent>
            <TaskList tasks={tasks} emptyMessage="No tasks have been created for this project yet." />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
