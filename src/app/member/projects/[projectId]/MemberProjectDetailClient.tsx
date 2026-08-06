'use client';

// src/app/member/projects/[projectId]/MemberProjectDetailClient.tsx
// Team Member view of a specific project's tasks (assigned to them only).

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/AuthContext';
import { getProjectById } from '@/services/projects';
import { getProjectMembers } from '@/services/projectMembers';
import { getTasksByProject } from '@/services/tasks';
import { getUserById, getUsersByIds } from '@/services/users';
import { Project, TaskWithUsers, User } from '@/types';
import { StatCard } from '@/components/ui/stat-card';
import { TaskList } from '@/components/tasks/TaskList';
import { isOverdue, formatDate } from '@/lib/utils/dates';
import { FolderKanban, ShieldAlert, ArrowLeft, Users, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import Link from 'next/link';

export default function MemberProjectDetailClient() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { role, firebaseUser } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [teamLead, setTeamLead] = useState<User | null>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<TaskWithUsers[]>([]);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!loading && role !== 'TEAM_MEMBER') {
      router.push('/login');
    }
  }, [role, loading, router]);

  useEffect(() => {
    async function loadProjectDetails() {
      if (!projectId || !firebaseUser) return;
      try {
        const projectData = await getProjectById(projectId);
        if (!projectData) {
          router.push('/member/projects');
          return;
        }

        const memberships = await getProjectMembers(projectId);
        const isAssignedMember = memberships.some(
          (m) => m.userId === firebaseUser.uid && m.role === 'TEAM_MEMBER'
        );

        if (!isAssignedMember) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        setAuthorized(true);
        setProject(projectData);

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

        const rawTasks = await getTasksByProject(projectId);
        
        // Filter tasks assigned to current user only
        const myTasks = rawTasks.filter((t) => t.assignedTo === firebaseUser.uid);
        
        const enriched = myTasks.map((task) => {
          const assignee = users.find((u) => u.id === task.assignedTo) || null;
          return {
            ...task,
            assignedToUser: assignee,
            createdByUser: null,
          };
        });
        setTasks(enriched);
      } catch (error) {
        console.error('Failed to load project details for member', error);
      } finally {
        setLoading(false);
      }
    }

    if (role === 'TEAM_MEMBER') {
      loadProjectDetails();
    }
  }, [projectId, role, firebaseUser, router]);

  // Task statistics
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

  if (role !== 'TEAM_MEMBER' || !authorized || !project) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-2">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-xl font-bold">Access Denied / Not Found</h2>
          <p className="text-muted-foreground">
            You are either not assigned to this project or the project does not exist.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="space-y-1">
          <Link
            href="/member/projects"
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:underline text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Projects
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <FolderKanban className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">{project.description}</p>
        </div>

        {/* Project details card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                <span className="text-xs font-medium text-muted-foreground block">STATUS</span>
                <StatusBadge status={project.status} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" /> Assignments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-xs font-medium text-muted-foreground block mb-1">TEAM LEAD</span>
                <p className="font-semibold">{teamLead ? teamLead.name : 'No lead assigned'}</p>
                <p className="text-xs text-muted-foreground">{teamLead?.email}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Member project task stats */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <StatCard title="My Tasks" value={totalTasks} />
          <StatCard title="To Do" value={todoTasks} />
          <StatCard title="In Progress" value={inProgressTasks} />
          <StatCard title="Completed" value={completedTasks} />
          <StatCard title="Blocked" value={blockedTasks} className={blockedTasks > 0 ? 'bg-rose-50/20 border-rose-200' : ''} />
          <StatCard title="Overdue" value={overdueTasks} className={overdueTasks > 0 ? 'bg-amber-50/20 border-amber-200' : ''} />
        </div>

        {/* Member task list */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold">My Tasks in Project</h2>
          <TaskList tasks={tasks} emptyMessage="No tasks assigned to you on this project." />
        </div>
      </div>
    </AppLayout>
  );
}
