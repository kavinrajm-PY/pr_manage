// src/types/index.ts
// All TypeScript interfaces and enums for the Project Management System

// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = 'PROJECT_MANAGER' | 'TEAM_LEAD' | 'TEAM_MEMBER';

export type ProjectStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// ─── Firestore Document Interfaces ────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  profileImage?: string;
  isActive: boolean;
  createdAt: string; // ISO string
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string; // ISO string (date only)
  deadline: string;  // ISO string (date only)
  createdBy: string; // userId
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: UserRole;
  addedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  assignedTo: string;  // userId
  createdBy: string;   // userId
  priority: TaskPriority;
  status: TaskStatus;
  deadline: string;    // ISO string (date only)
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Computed / UI Interfaces ─────────────────────────────────────────────────

/** Project enriched with runtime statistics for PM dashboard */
export interface ProjectWithStats extends Project {
  teamLead: User | null;
  teamMembers: User[];
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  progressPercent: number; // 0–100
}

/** Task enriched with assignee and creator details */
export interface TaskWithUsers extends Task {
  assignedToUser: User | null;
  createdByUser: User | null;
}

/** Completion statistics for the project detail dashboard */
export interface CompletionStats {
  completedOnTime: number;
  completedLate: number;
  currentlyOverdue: number;
}

export type NotificationType = 'PROJECT_ASSIGNED' | 'TASK_ASSIGNED' | 'COMMENT_ADDED' | 'STATUS_UPDATED';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: string;
}
