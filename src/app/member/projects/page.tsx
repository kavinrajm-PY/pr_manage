'use client';

// src/app/member/projects/page.tsx
// Team Member page to list all projects they are assigned to.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/AuthContext';
import { getMembershipsByUser } from '@/services/projectMembers';
import { getProjectById } from '@/services/projects';
import { enrichProjects } from '@/services/projectEnrichment';
import { ProjectWithStats, Project } from '@/types';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { FolderKanban, ShieldAlert } from 'lucide-react';

export default function MemberProjectsPage() {
  const { role, firebaseUser } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectWithStats[]>([]);

  useEffect(() => {
    if (!loading && role !== 'TEAM_MEMBER') {
      router.push('/login');
    }
  }, [role, loading, router]);

  useEffect(() => {
    async function loadProjects() {
      if (!firebaseUser) return;
      try {
        const memberships = await getMembershipsByUser(firebaseUser.uid);
        const memberMemberships = memberships.filter((m) => m.role === 'TEAM_MEMBER');
        const projectIds = memberMemberships.map((m) => m.projectId);

        if (projectIds.length === 0) {
          setProjects([]);
          setLoading(false);
          return;
        }

        const projectsData = await Promise.all(
          projectIds.map((pid) => getProjectById(pid))
        );
        const validProjects = projectsData.filter((p): p is Project => p !== null);
        const enriched = await enrichProjects(validProjects);
        setProjects(enriched);
      } catch (error) {
        console.error('Failed to load member projects', error);
      } finally {
        setLoading(false);
      }
    }

    if (role === 'TEAM_MEMBER') {
      loadProjects();
    }
  }, [role, firebaseUser]);

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
          <FolderKanban className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">My Assigned Projects</h1>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center bg-card text-muted-foreground">
            <FolderKanban className="mx-auto h-10 w-10 mb-3 text-muted-foreground" />
            <h3 className="font-semibold text-lg">No Projects Assigned</h3>
            <p className="text-sm">You are not currently assigned as a Member to any project.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} hrefPrefix="/member/projects" />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
