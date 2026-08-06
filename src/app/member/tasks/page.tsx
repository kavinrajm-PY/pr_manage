'use client';

// src/app/member/tasks/page.tsx
// Team Member Dashboard displaying assigned tasks only.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/AuthContext';
import { getTasksByAssignee } from '@/services/tasks';
import { getProjectById } from '@/services/projects';
import { TaskWithUsers } from '@/types';
import { StatCard } from '@/components/ui/stat-card';
import { TaskList } from '@/components/tasks/TaskList';
import { isOverdue } from '@/lib/utils/dates';
import { CheckSquare, PlayCircle, Ban, AlertCircle, ShieldAlert } from 'lucide-react';

export default function MemberTasksPage() {
  const { role, firebaseUser, userProfile } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskWithUsers[]>([]);
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && role !== 'TEAM_MEMBER') {
      router.push('/login');
    }
  }, [role, loading, router]);

  useEffect(() => {
    async function loadTasks() {
      if (!firebaseUser) return;
      try {
        // 1. Fetch tasks assigned to current user
        const myTasks = await getTasksByAssignee(firebaseUser.uid);
        
        // 2. Load unique project names
        const projectIds = Array.from(new Set(myTasks.map((t) => t.projectId)));
        const projectsData = await Promise.all(
          projectIds.map((pid) => getProjectById(pid))
        );

        const pMap: Record<string, string> = {};
        projectsData.forEach((p) => {
          if (p) pMap[p.id] = p.name;
        });
        setProjectsMap(pMap);

        // 3. Map with user info (since it's assigned to self, assignedToUser is the user profile)
        const enriched = myTasks.map((task) => ({
          ...task,
          assignedToUser: userProfile,
          createdByUser: null,
        }));

        setTasks(enriched);
      } catch (error) {
        console.error('Failed to load member tasks', error);
      } finally {
        setLoading(false);
      }
    }

    if (role === 'TEAM_MEMBER') {
      loadTasks();
    }
  }, [role, firebaseUser, userProfile]);

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

  if (role !== 'TEAM_MEMBER') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-2">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">Only Team Members can access this page.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">My Task Board</h1>
        </div>

        {/* Member task metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <StatCard title="Assigned Tasks" value={totalTasks} />
          <StatCard title="To Do" value={todoTasks} />
          <StatCard title="In Progress" value={inProgressTasks} icon={<PlayCircle className="h-4 w-4 text-blue-500" />} />
          <StatCard title="Completed" value={completedTasks} />
          <StatCard title="Blocked" value={blockedTasks} icon={<Ban className="h-4 w-4 text-rose-500" />} className={blockedTasks > 0 ? 'bg-rose-50/20 border-rose-200' : ''} />
          <StatCard title="Overdue" value={overdueTasks} icon={<AlertCircle className="h-4 w-4 text-amber-500" />} className={overdueTasks > 0 ? 'bg-amber-50/20 border-amber-200' : ''} />
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold">My Tasks</h2>
          <TaskList
            tasks={tasks}
            emptyMessage="Excellent! You have no tasks assigned to you."
            showProjectName={true}
            projectsMap={projectsMap}
          />
        </div>
      </div>
    </AppLayout>
  );
}
