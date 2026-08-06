'use client';

// src/app/lead/dashboard/page.tsx
// Team Lead Dashboard focusing on metrics and tasks within assigned projects.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/AuthContext';
import { getMembershipsByUser } from '@/services/projectMembers';
import { getProjectById } from '@/services/projects';
import { getTasksByProject } from '@/services/tasks';
import { getUsersByIds } from '@/services/users';
import { Project, TaskWithUsers, User } from '@/types';
import { StatCard } from '@/components/ui/stat-card';
import { TaskList } from '@/components/tasks/TaskList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isOverdue } from '@/lib/utils/dates';
import { LayoutDashboard, CheckCircle2, Ban, AlertCircle, PlayCircle, FolderKanban, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function LeadDashboard() {
  const { role, firebaseUser } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskWithUsers[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && role !== 'TEAM_LEAD') {
      router.push('/login');
    }
  }, [role, loading, router]);

  useEffect(() => {
    async function loadLeadData() {
      if (!firebaseUser) return;
      try {
        // 1. Get memberships for Team Lead
        const memberships = await getMembershipsByUser(firebaseUser.uid);
        // Filter memberships where user is TEAM_LEAD (or has access)
        const leadMemberships = memberships.filter((m) => m.role === 'TEAM_LEAD');
        const projectIds = leadMemberships.map((m) => m.projectId);

        if (projectIds.length === 0) {
          setLoading(false);
          return;
        }

        // 2. Load project documents
        const projectsData = await Promise.all(
          projectIds.map((pid) => getProjectById(pid))
        );
        const validProjects = projectsData.filter((p): p is Project => p !== null);
        setProjects(validProjects);

        // Map projectId to name for the task list
        const pMap: Record<string, string> = {};
        validProjects.forEach((p) => {
          pMap[p.id] = p.name;
        });
        setProjectsMap(pMap);

        // 3. Load all tasks for these projects
        const tasksLists = await Promise.all(
          projectIds.map((pid) => getTasksByProject(pid))
        );
        const flatTasks = tasksLists.flat();

        // 4. Enrich tasks with user details
        const assigneeIds = Array.from(new Set(flatTasks.map((t) => t.assignedTo)));
        const users = await getUsersByIds(assigneeIds);

        const enriched = flatTasks.map((task) => {
          const assignee = users.find((u) => u.id === task.assignedTo) || null;
          return {
            ...task,
            assignedToUser: assignee,
            createdByUser: null, // Lead creator is implicitly lead/system
          };
        });

        setTasks(enriched);
      } catch (error) {
        console.error('Failed to load lead dashboard', error);
      } finally {
        setLoading(false);
      }
    }

    if (role === 'TEAM_LEAD') {
      loadLeadData();
    }
  }, [role, firebaseUser]);

  // Aggregate stats
  const totalTasks = tasks.length;
  const todoTasks = tasks.filter((t) => t.status === 'TODO').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const blockedTasks = tasks.filter((t) => t.status === 'BLOCKED').length;
  const overdueTasks = tasks.filter((t) => isOverdue(t)).length;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (role !== 'TEAM_LEAD') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-2">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">Only Team Leads can access this dashboard.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Team Lead Workspace</h1>
        </div>

        {/* Dashboard summary metric blocks */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <StatCard title="Total Tasks" value={totalTasks} />
          <StatCard title="To Do" value={todoTasks} icon={<PlayCircle className="h-4 w-4 text-slate-500" />} />
          <StatCard title="In Progress" value={inProgressTasks} icon={<PlayCircle className="h-4 w-4 text-blue-500" />} />
          <StatCard title="Completed" value={completedTasks} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} />
          <StatCard title="Blocked" value={blockedTasks} icon={<Ban className="h-4 w-4 text-rose-500" />} className={blockedTasks > 0 ? 'bg-rose-50/20 border-rose-200' : ''} />
          <StatCard title="Overdue" value={overdueTasks} icon={<AlertCircle className="h-4 w-4 text-amber-500" />} className={overdueTasks > 0 ? 'bg-amber-50/20 border-amber-200' : ''} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects List Card */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FolderKanban className="h-4 w-4" /> My Assigned Projects
              </CardTitle>
              <CardDescription>Select a project to manage and create tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50 border transition-colors"
                >
                  <div className="text-sm font-semibold truncate max-w-[180px]">
                    {project.name}
                  </div>
                  <Link
                    href={`/lead/projects/${project.id}`}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Manage →
                  </Link>
                </div>
              ))}
              {projects.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-6">
                  You are not assigned to any projects.
                </div>
              )}
            </CardContent>
          </Card>

          {/* All Project Tasks Card */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold">Consolidated Task Board</h2>
            <TaskList
              tasks={tasks}
              emptyMessage="No tasks found across your assigned projects."
              showProjectName={true}
              projectsMap={projectsMap}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
