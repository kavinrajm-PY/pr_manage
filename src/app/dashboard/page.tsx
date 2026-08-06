'use client';

// src/app/dashboard/page.tsx
// Project Manager Home/Dashboard showing overall metrics and project list.
// Optimised: single useEffect, skeleton cards while loading (no full-screen spinner).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/AuthContext';
import { getAllProjects } from '@/services/projects';
import { enrichProjects } from '@/services/projectEnrichment';
import { ProjectWithStats } from '@/types';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { StatCard } from '@/components/ui/stat-card';
import { FolderKanban, CheckSquare, AlertCircle, Ban, Plus, LayoutDashboard, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3 animate-pulse">
      <div className="h-4 bg-muted/70 rounded w-3/4" />
      <div className="h-3 bg-muted/50 rounded w-1/2" />
      <div className="h-2 bg-muted/40 rounded-full w-full mt-4" />
      <div className="flex gap-2 pt-1">
        <div className="h-5 bg-muted/50 rounded w-16" />
        <div className="h-5 bg-muted/50 rounded w-16" />
      </div>
    </div>
  );
}

export default function PMDashboard() {
  const { role, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    // Wait until auth is resolved
    if (authLoading) return;

    if (role !== 'PROJECT_MANAGER') {
      router.push('/login');
      return;
    }

    let cancelled = false;
    async function loadDashboardData() {
      try {
        const allProjects = await getAllProjects();
        const enriched = await enrichProjects(allProjects);
        if (!cancelled) setProjects(enriched);
      } catch (error) {
        console.error('Failed to load dashboard data', error);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }
    loadDashboardData();
    return () => { cancelled = true; };
  }, [authLoading, role, router]);

  // Aggregate stats
  const totalProjects = projects.length;
  const totalTasks = projects.reduce((acc, p) => acc + p.totalTasks, 0);
  const completedTasks = projects.reduce((acc, p) => acc + p.completedTasks, 0);
  const blockedTasks = projects.reduce((acc, p) => acc + p.blockedTasks, 0);
  const overdueTasks = projects.reduce((acc, p) => acc + p.overdueTasks, 0);
  const averageProgress =
    totalProjects > 0
      ? Math.round(projects.reduce((acc, p) => acc + p.progressPercent, 0) / totalProjects)
      : 0;

  // Show access denied only after auth is confirmed
  if (!authLoading && role !== 'PROJECT_MANAGER') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-2">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">Only Project Managers can access this dashboard.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Executive Dashboard</h1>
          </div>
          <Button onClick={() => router.push('/projects/create')} className="gap-2 self-start sm:self-auto">
            <Plus className="h-4 w-4" /> Create Project
          </Button>
        </div>

        {/* Summary Cards — show immediately with 0 values while data loads */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Projects" value={totalProjects} subtext="Total active projects" icon={<FolderKanban className="h-4 w-4" />} />
          <StatCard title="Overall Progress" value={`${averageProgress}%`} subtext="Average completion rate" icon={<CheckSquare className="h-4 w-4 text-emerald-500" />} />
          <StatCard title="Total Tasks" value={totalTasks} subtext={`${completedTasks} tasks completed`} icon={<CheckSquare className="h-4 w-4" />} />
          <StatCard title="Blocked Tasks" value={blockedTasks} subtext="Require attention" icon={<Ban className="h-4 w-4 text-rose-500" />} className={blockedTasks > 0 ? 'border-rose-200 dark:border-rose-900/50' : ''} />
          <StatCard title="Overdue Tasks" value={overdueTasks} subtext="Missed deadlines" icon={<AlertCircle className="h-4 w-4 text-amber-500" />} className={overdueTasks > 0 ? 'border-amber-200 dark:border-amber-900/50' : ''} />
        </div>

        {/* Project Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Active Projects</h2>
          {dataLoading ? (
            // Skeleton placeholders while projects load
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center bg-card">
              <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="font-semibold text-lg">No Projects Created Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Get started by creating your first company project.</p>
              <Button onClick={() => router.push('/projects/create')}>Create Project</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
