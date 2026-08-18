'use client';

// src/components/users/UserDetailsDialog.tsx
// PM dialog: view user task workload, filter by project, toggle Active/Inactive status.

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { User, Task, Project, UserRole } from '@/types';
import { getTasksByAssignee } from '@/services/tasks';
import { getAllProjects } from '@/services/projects';
import { updateUser } from '@/services/users';
import { useToast } from '@/hooks/use-toast';
import { PriorityBadge } from '@/components/ui/priority-badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils/dates';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Briefcase,
  ClipboardList,
  UserCircle2,
  Mail,
  ShieldCheck,
} from 'lucide-react';

interface UserDetailsDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (updatedUser: User) => void;
}

export function UserDetailsDialog({ user, isOpen, onClose, onUserUpdated }: UserDetailsDialogProps) {
  const { toast } = useToast();
  // Store toast in a ref so it never enters dependency arrays
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<string, Project>>({});
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [statusVal, setStatusVal] = useState<string>('ACTIVE');

  // Load workload only when dialog opens and user changes
  useEffect(() => {
    if (!isOpen || !user) return;

    // Capture userId immediately — avoids 'user possibly null' inside async callback
    const userId = user.id;
    const userName = user.name;
    const initialStatus = user.isActive ? 'ACTIVE' : 'INACTIVE';

    let cancelled = false;

    async function loadWorkload() {
      setLoading(true);
      setTasks([]);
      setUserProjects([]);
      setProjectsMap({});
      setSelectedProjectId('ALL');
      setStatusVal(initialStatus);

      try {
        const [rawTasks, allProj] = await Promise.all([
          getTasksByAssignee(userId),
          getAllProjects(),
        ]);

        if (cancelled) return;

        const projMap: Record<string, Project> = {};
        allProj.forEach((p) => { projMap[p.id] = p; });
        setProjectsMap(projMap);

        const sorted = [...rawTasks].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setTasks(sorted);

        const seenIds = new Set<string>();
        const userProjList: Project[] = [];
        for (const t of rawTasks) {
          if (!seenIds.has(t.projectId) && projMap[t.projectId]) {
            seenIds.add(t.projectId);
            userProjList.push(projMap[t.projectId]);
          }
        }
        setUserProjects(userProjList);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load user workload', err);
        toastRef.current({
          title: 'Error',
          description: `Could not load task data for ${userName}.`,
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWorkload();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isOpen]);

  async function handleStatusChange(newStatus: string) {
    if (!user) return;
    const userId = user.id;
    const userName = user.name;
    setUpdating(true);
    try {
      const isActive = newStatus === 'ACTIVE';
      await updateUser(userId, { isActive });
      setStatusVal(newStatus);
      onUserUpdated({ ...user, isActive });
      toastRef.current({
        title: 'Status Updated',
        description: `${userName} is now marked as ${isActive ? 'Active' : 'Inactive'}.`,
      });
    } catch (err: any) {
      console.error('Failed to update status', err);
      toastRef.current({
        title: 'Update Failed',
        description: err?.message || 'Could not update status.',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  }

  async function handleRoleChange(newRole: UserRole) {
    if (!user) return;
    const userId = user.id;
    const userName = user.name;
    setUpdating(true);
    try {
      await updateUser(userId, { role: newRole });
      onUserUpdated({ ...user, role: newRole });
      toastRef.current({
        title: 'Role Updated',
        description: `${userName}'s role is now set to ${newRole.replace(/_/g, ' ').toLowerCase()}.`,
      });
    } catch (err: any) {
      console.error('Failed to update role', err);
      toastRef.current({
        title: 'Update Failed',
        description: err?.message || 'Could not update role.',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  }

  const filteredTasks =
    selectedProjectId === 'ALL'
      ? tasks
      : tasks.filter((t) => t.projectId === selectedProjectId);

  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const overdueCount = tasks.filter(
    (t) => t.status !== 'COMPLETED' && new Date() > new Date(t.deadline)
  ).length;

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-hidden flex flex-col p-0">

        {/* ── Header ── */}
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogHeader className="space-y-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Avatar circle */}
                <div className="w-12 h-12 rounded-full bg-primary/15 border-2 border-primary/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-extrabold text-primary select-none">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-foreground leading-tight">
                    {user.name}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-1.5 text-xs mt-0.5">
                    <Mail className="w-3 h-3" /> {user.email}
                    <span className="mx-1 text-muted-foreground/50">•</span>
                    <ShieldCheck className="w-3 h-3 text-primary" />
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                      disabled={updating}
                      className="bg-transparent border-0 font-semibold text-primary capitalize outline-none cursor-pointer hover:underline text-xs p-0 m-0"
                    >
                      <option value="PROJECT_MANAGER" className="text-foreground">Project Manager</option>
                      <option value="TEAM_LEAD" className="text-foreground">Team Lead</option>
                      <option value="TEAM_MEMBER" className="text-foreground">Team Member</option>
                    </select>
                  </DialogDescription>
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</span>
                <select
                  value={statusVal}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={updating}
                  className={`h-8 rounded-full border px-3 text-xs font-bold outline-none cursor-pointer transition-all focus:ring-2 focus:ring-primary/30 ${
                    statusVal === 'ACTIVE'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-700'
                      : 'border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-700'
                  } ${updating ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <option value="ACTIVE">● Active</option>
                  <option value="INACTIVE">● Inactive</option>
                </select>
                {updating && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
              </div>
            </div>

            {/* Quick Stats Row */}
            <div className="flex items-center gap-3 mt-4">
              {[
                { label: 'Total Tasks', value: tasks.length, color: 'bg-primary/10 text-primary' },
                { label: 'In Progress', value: inProgressCount, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
                { label: 'Completed', value: completedCount, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
                { label: 'Overdue', value: overdueCount, color: overdueCount > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-muted text-muted-foreground' },
              ].map((stat) => (
                <div key={stat.label} className={`flex-1 text-center rounded-lg py-2 px-1 ${stat.color}`}>
                  <div className="text-lg font-extrabold leading-none">{stat.value}</div>
                  <div className="text-[10px] font-semibold opacity-80 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </DialogHeader>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading ? (
            <div className="flex flex-col h-52 items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Loading task workload…</p>
            </div>
          ) : (
            <>
              {/* Filter Bar */}
              <div className="flex items-center justify-between gap-3 bg-muted/30 border rounded-xl px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Briefcase className="w-3.5 h-3.5 text-primary" />
                  Filter by Project:
                </div>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-medium focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                >
                  <option value="ALL">All Projects ({userProjects.length})</option>
                  {userProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Section heading */}
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  Tasks ({filteredTasks.length})
                </h3>
              </div>

              {/* Task list */}
              <div className="space-y-2.5">
                {filteredTasks.map((task) => {
                  const project = projectsMap[task.projectId];
                  const isOverdue =
                    task.status !== 'COMPLETED' && new Date() > new Date(task.deadline);

                  return (
                    <div
                      key={task.id}
                      className="group relative p-4 border rounded-xl bg-card hover:shadow-md hover:border-primary/30 transition-all duration-200 space-y-2.5"
                    >
                      {/* Project label */}
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3 h-3 text-primary/60" />
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                          {project ? project.name : 'Unknown Project'}
                        </span>
                      </div>

                      {/* Task title + badges */}
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-sm text-foreground leading-snug flex-1">
                          {task.title}
                        </h4>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <PriorityBadge priority={task.priority} />
                          <StatusBadge status={task.status} />
                        </div>
                      </div>

                      {/* Footer row */}
                      <div className="flex items-center justify-between pt-1 border-t border-dashed border-muted text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Due {formatDate(task.deadline)}
                        </span>
                        <div className="flex items-center gap-2">
                          {isOverdue && (
                            <span className="flex items-center gap-1 text-rose-600 font-bold">
                              <AlertCircle className="w-3 h-3" /> Overdue
                            </span>
                          )}
                          {task.status === 'COMPLETED' && (
                            <span className="flex items-center gap-1 text-emerald-600 font-bold">
                              <CheckCircle2 className="w-3 h-3" /> Done
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredTasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-14 border-2 border-dashed rounded-xl text-muted-foreground bg-muted/10 gap-2">
                    <ClipboardList className="h-10 w-10 text-muted-foreground/30" />
                    <p className="text-sm font-semibold">No tasks found</p>
                    <p className="text-xs opacity-70">
                      {selectedProjectId === 'ALL'
                        ? 'This user has no assigned tasks yet.'
                        : 'No tasks in this project.'}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
