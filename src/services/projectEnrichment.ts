// src/services/projectEnrichment.ts
// Optimised service that enriches all projects in a single batch pass.
//
// Old strategy (N projects): N × getProjectMembers + N × getUsersByIds + N × getTasksByProject = 3N Firestore round trips
// New strategy: 1 parallel batch for all memberships + 1 getUsersByIds for all unique users + 1 parallel batch for all tasks = ~3 round trips total

import { Project, ProjectWithStats, User, Task } from '@/types';
import { getProjectMembers, getProjectMembersByProjects } from './projectMembers';
import { getUsersByIds } from './users';
import { getTasksByProject, getTasksByProjects } from './tasks';
import { isOverdue } from '@/lib/utils/dates';

function buildStats(tasks: Task[], teamLead: User | null, teamMembers: User[]): Omit<ProjectWithStats, keyof Project> {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const todoTasks = tasks.filter((t) => t.status === 'TODO').length;
  const blockedTasks = tasks.filter((t) => t.status === 'BLOCKED').length;
  const overdueTasks = tasks.filter((t) => isOverdue(t)).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    teamLead,
    teamMembers,
    totalTasks,
    completedTasks,
    inProgressTasks,
    todoTasks,
    blockedTasks,
    overdueTasks,
    progressPercent,
  };
}

/**
 * Enriches a single project with members, lead, tasks, and status counts.
 * Use enrichProjects() for multiple projects — it is far more efficient.
 */
export async function enrichProject(project: Project): Promise<ProjectWithStats> {
  const [memberships, tasks] = await Promise.all([
    getProjectMembers(project.id),
    getTasksByProject(project.id),
  ]);

  const userIds = memberships.map((m) => m.userId);
  const users = await getUsersByIds(userIds);

  let teamLead: User | null = null;
  const teamMembers: User[] = [];
  memberships.forEach((m) => {
    const u = users.find((u) => u.id === m.userId);
    if (u) {
      if (m.role === 'TEAM_LEAD') teamLead = u;
      else if (m.role === 'TEAM_MEMBER') teamMembers.push(u);
    }
  });

  return { ...project, ...buildStats(tasks, teamLead, teamMembers) };
}

/**
 * Enriches multiple projects with a single batch Firestore pass.
 * Reduces 3N sequential calls to ~3 parallel calls regardless of N.
 */
export async function enrichProjects(projects: Project[]): Promise<ProjectWithStats[]> {
  if (projects.length === 0) return [];

  const projectIds = projects.map((p) => p.id);

  // Step 1: Fetch all memberships for all projects in a single batch pass (chunked)
  const memberships = await getProjectMembersByProjects(projectIds);
  const membershipsByProject: Record<string, typeof memberships> = {};
  memberships.forEach((m) => {
    if (!membershipsByProject[m.projectId]) {
      membershipsByProject[m.projectId] = [];
    }
    membershipsByProject[m.projectId].push(m);
  });

  // Step 2: Collect ALL unique userIds across every project, then fetch in ONE call
  const uniqueUserIds = Array.from(new Set(memberships.map((m) => m.userId)));
  const allUsers = await getUsersByIds(uniqueUserIds);
  const usersById: Record<string, User> = {};
  allUsers.forEach((u) => { usersById[u.id] = u; });

  // Step 3: Fetch all tasks for all projects in a single batch pass (chunked)
  const tasks = await getTasksByProjects(projectIds);
  const tasksByProject: Record<string, Task[]> = {};
  tasks.forEach((t) => {
    if (!tasksByProject[t.projectId]) {
      tasksByProject[t.projectId] = [];
    }
    tasksByProject[t.projectId].push(t);
  });

  // Step 4: Assemble results — pure in-memory work, no more Firestore calls
  return projects.map((project) => {
    const projectMemberships = membershipsByProject[project.id] ?? [];
    const projectTasks = tasksByProject[project.id] ?? [];

    let teamLead: User | null = null;
    const teamMembers: User[] = [];
    projectMemberships.forEach((m) => {
      const u = usersById[m.userId];
      if (u) {
        if (m.role === 'TEAM_LEAD') teamLead = u;
        else if (m.role === 'TEAM_MEMBER') teamMembers.push(u);
      }
    });

    return { ...project, ...buildStats(projectTasks, teamLead, teamMembers) };
  });
}
