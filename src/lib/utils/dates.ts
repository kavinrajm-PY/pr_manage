// src/lib/utils/dates.ts
// Date calculation utilities for deadlines and completion statistics

import { Task } from '@/types';

/**
 * Returns true if a task is overdue:
 * Current date > deadline AND status != COMPLETED
 */
export function isOverdue(task: Pick<Task, 'deadline' | 'status'>): boolean {
  if (task.status === 'COMPLETED') return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(task.deadline);
  deadline.setHours(0, 0, 0, 0);
  return today > deadline;
}

/**
 * Returns true if a task was completed on time:
 * status = COMPLETED AND completedAt <= deadline
 */
export function isCompletedOnTime(
  task: Pick<Task, 'status' | 'completedAt' | 'deadline'>
): boolean {
  if (task.status !== 'COMPLETED' || !task.completedAt) return false;
  const completed = new Date(task.completedAt);
  const deadline = new Date(task.deadline);
  completed.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return completed <= deadline;
}

/**
 * Returns true if a task was completed late:
 * status = COMPLETED AND completedAt > deadline
 */
export function isCompletedLate(
  task: Pick<Task, 'status' | 'completedAt' | 'deadline'>
): boolean {
  if (task.status !== 'COMPLETED' || !task.completedAt) return false;
  const completed = new Date(task.completedAt);
  const deadline = new Date(task.deadline);
  completed.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  return completed > deadline;
}

/**
 * Calculates project progress as percentage of completed tasks
 */
export function calcProgress(total: number, completed: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Format a date string to a readable format (e.g. "Aug 08")
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

/**
 * Format a date string to date and time (e.g. "Aug 08, 10:30 AM")
 */
export function formatDateWithTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
  }) + ', ' + date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date string to full format (e.g. "August 8, 2025")
 */
export function formatDateFull(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Returns number of days until deadline (negative if past)
 */
export function daysUntilDeadline(deadlineStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineStr);
  deadline.setHours(0, 0, 0, 0);
  const diff = deadline.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

/**
 * Returns tasks sorted by deadline ascending (soonest first)
 */
export function sortByDeadline<T extends { deadline: string }>(tasks: T[]): T[] {
  return [...tasks].sort(
    (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  );
}
