'use client';

// src/app/lead/projects/[projectId]/LeadProjectDetailClient.tsx
// Team Lead page to manage a specific project's tasks client view.

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/AuthContext';
import { getProjectById } from '@/services/projects';
import { getProjectMembers } from '@/services/projectMembers';
import { getTasksByProject } from '@/services/tasks';
import { getUsersByIds } from '@/services/users';
import { Project, TaskWithUsers, User } from '@/types';
import { StatCard } from '@/components/ui/stat-card';
import { TaskList } from '@/components/tasks/TaskList';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { BunchTasksDialog } from '@/components/tasks/BunchTasksDialog';
import { Card, CardContent } from '@/components/ui/card';
import { isOverdue } from '@/lib/utils/dates';
import { FolderKanban, ShieldAlert, ArrowLeft, Users } from 'lucide-react';
import Link from 'next/link';

export default function LeadProjectDetailClient() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { role, firebaseUser } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [projectMembers, setProjectMembers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<TaskWithUsers[]>([]);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!loading && role !== 'TEAM_LEAD') {
      router.push('/login');
    }
  }, [role, loading, router]);

  useEffect(() => {
    async function loadProjectDetails() {
      if (!projectId || !firebaseUser) return;
      try {
        const projectData = await getProjectById(projectId);
        if (!projectData) {
          router.push('/lead/dashboard');
          return;
        }

        // Fetch memberships and tasks in parallel for speed
        const [memberships, rawTasks] = await Promise.all([
          getProjectMembers(projectId),
          getTasksByProject(projectId),
        ]);

        const isAssignedLead = memberships.some(
          (m) => m.userId === firebaseUser.uid && m.role === 'TEAM_LEAD'
        );

        if (!isAssignedLead) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        setAuthorized(true);
        setProject(projectData);

        const uids = memberships.map((m) => m.userId);
        const users = await getUsersByIds(uids);

        // Only active members and team leads can be assigned tasks
        const membersProfiles = users.filter((u) =>
          u.isActive !== false &&
          memberships.some((m) => m.userId === u.id && (m.role === 'TEAM_MEMBER' || m.role === 'TEAM_LEAD'))
        );
        setProjectMembers(membersProfiles);

        const enriched = rawTasks.map((task) => {
          const assignee = users.find((u) => u.id === task.assignedTo) || null;
          return {
            ...task,
            assignedToUser: assignee,
            createdByUser: null,
          };
        });
        setTasks(enriched);
      } catch (error) {
        console.error('Failed to load project details', error);
      } finally {
        setLoading(false);
      }
    }

    if (role === 'TEAM_LEAD') {
      loadProjectDetails();
    }
  }, [projectId, role, firebaseUser, router]);

  const handleTaskCreated = (newTask: any) => {
    const assignee = projectMembers.find((u) => u.id === newTask.assignedTo) || null;
    const enriched: TaskWithUsers = {
      ...newTask,
      assignedToUser: assignee,
      createdByUser: null,
    };
    setTasks((prev) => [enriched, ...prev]);
  };

  const handleTasksCreated = (newTasks: any[]) => {
    const enriched: TaskWithUsers[] = newTasks.map((newTask) => {
      const assignee = projectMembers.find((u) => u.id === newTask.assignedTo) || null;
      return {
        ...newTask,
        assignedToUser: assignee,
        createdByUser: null,
      };
    });
    setTasks((prev) => [...enriched, ...prev]);
  };

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

  if (role !== 'TEAM_LEAD' || !authorized || !project) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-2">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-xl font-bold">Access Denied / Not Found</h2>
          <p className="text-muted-foreground">
            You are either not assigned as the Team Lead of this project or the project does not exist.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              href="/lead/dashboard"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:underline text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Link>
            <div className="flex items-center gap-2 mt-1">
              <FolderKanban className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            </div>
            <p className="text-muted-foreground">{project.description}</p>
          </div>

          <div className="flex items-center gap-3">
            <BunchTasksDialog
              project={project}
              projectMembers={projectMembers}
              onTasksCreated={handleTasksCreated}
            />
            <CreateTaskDialog
              project={project}
              projectMembers={projectMembers}
              onTaskCreated={handleTaskCreated}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <StatCard title="Total Tasks" value={totalTasks} />
          <StatCard title="To Do" value={todoTasks} />
          <StatCard title="In Progress" value={inProgressTasks} />
          <StatCard title="Completed" value={completedTasks} />
          <StatCard title="Blocked" value={blockedTasks} className={blockedTasks > 0 ? 'bg-rose-50/20 border-rose-200' : ''} />
          <StatCard title="Overdue" value={overdueTasks} className={overdueTasks > 0 ? 'bg-amber-50/20 border-amber-200' : ''} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold">Tasks Board</h2>
            <TaskList tasks={tasks} emptyMessage="No tasks have been created for this project yet." />
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Team Members ({projectMembers.length})
            </h2>
            <Card>
              <CardContent className="pt-6 space-y-3">
                {projectMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-[#7c4d96]/[0.03] hover:ring-[#7c4d96]/20 transition-all duration-300"
                  >
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0 uppercase">
                      {member.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </div>
                ))}
                {projectMembers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No team members assigned to this project.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
