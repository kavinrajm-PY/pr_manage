'use client';

// src/app/projects/page.tsx
// PM only Projects List view with status tabs filtering.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/AuthContext';
import { getAllProjects } from '@/services/projects';
import { enrichProjects } from '@/services/projectEnrichment';
import { ProjectWithStats, ProjectStatus } from '@/types';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FolderKanban, Plus, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProjectsPage() {
  const { role } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loading && role !== 'PROJECT_MANAGER') {
      router.push('/login');
    }
  }, [role, loading, router]);

  useEffect(() => {
    async function loadProjects() {
      try {
        const allProjects = await getAllProjects();
        const enriched = await enrichProjects(allProjects);
        setProjects(enriched);
      } catch (error) {
        console.error('Failed to load projects', error);
      } finally {
        setLoading(false);
      }
    }
    if (role === 'PROJECT_MANAGER') {
      loadProjects();
    }
  }, [role]);

  const filterProjects = (status: ProjectStatus | 'ALL') => {
    if (status === 'ALL') return projects;
    return projects.filter((p) => p.status === status);
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

  if (role !== 'PROJECT_MANAGER') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-2">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">Only Project Managers can view all projects.</p>
        </div>
      </AppLayout>
    );
  }

  const renderProjectGrid = (status: ProjectStatus | 'ALL') => {
    const filtered = filterProjects(status);
    if (filtered.length === 0) {
      return (
        <div className="text-center py-12 border rounded-lg bg-card text-muted-foreground">
          No projects found in this category.
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Projects Directory</h1>
          </div>
          <Button onClick={() => router.push('/projects/create')} className="gap-2">
            <Plus className="h-4 w-4" /> Create Project
          </Button>
        </div>

        <Tabs defaultValue="ALL" className="w-full space-y-6">
          <TabsList className="grid grid-cols-5 w-full max-w-2xl">
            <TabsTrigger value="ALL">All</TabsTrigger>
            <TabsTrigger value="NOT_STARTED">Not Started</TabsTrigger>
            <TabsTrigger value="IN_PROGRESS">In Progress</TabsTrigger>
            <TabsTrigger value="ON_HOLD">On Hold</TabsTrigger>
            <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="ALL" className="space-y-4">
            {renderProjectGrid('ALL')}
          </TabsContent>
          <TabsContent value="NOT_STARTED" className="space-y-4">
            {renderProjectGrid('NOT_STARTED')}
          </TabsContent>
          <TabsContent value="IN_PROGRESS" className="space-y-4">
            {renderProjectGrid('IN_PROGRESS')}
          </TabsContent>
          <TabsContent value="ON_HOLD" className="space-y-4">
            {renderProjectGrid('ON_HOLD')}
          </TabsContent>
          <TabsContent value="COMPLETED" className="space-y-4">
            {renderProjectGrid('COMPLETED')}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
