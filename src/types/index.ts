// src/types/index.ts
// All TypeScript interfaces and enums for the Project Management System

// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = 'PROJECT_MANAGER' | 'TEAM_LEAD' | 'TEAM_MEMBER';

export type ProjectStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// ─── Firestore Document Interfaces ────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  profileImage?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  deadline: string;
  createdBy: string;
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
  assignedTo: string;
  createdBy: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline: string;
  completedAt: string | null;
  completionPercent: number; // 0–100, updated by team member when IN_PROGRESS
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

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  reason: string;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveStatus;
  pmComment: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskProgressHistory {
  id: string;
  taskId: string;
  previousProgress: number;
  newProgress: number;
  previousStatus: TaskStatus;
  newStatus: TaskStatus;
  updatedBy: string;
  updatedAt: string;
}

// ─── Computed / UI Interfaces ─────────────────────────────────────────────────

export interface ProjectWithStats extends Project {
  teamLead: User | null;
  teamMembers: User[];
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  progressPercent: number;
}

export interface TaskWithUsers extends Task {
  assignedToUser: User | null;
  createdByUser: User | null;
}

export interface CompletionStats {
  completedOnTime: number;
  completedLate: number;
  currentlyOverdue: number;
}

export type NotificationType = 'PROJECT_ASSIGNED' | 'TASK_ASSIGNED' | 'COMMENT_ADDED' | 'STATUS_UPDATED' | 'LEAVE_REQUESTED' | 'LEAVE_STATUS_UPDATED';

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
