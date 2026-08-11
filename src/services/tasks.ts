// src/services/tasks.ts
// Firestore CRUD for the 'tasks' collection

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import { Task, TaskStatus, TaskPriority } from '@/types';

const COLLECTION = 'tasks';

function toTask(data: Record<string, unknown>, id: string): Task {
  const toISO = (v: unknown) => {
    if (!v) return null;
    if (v instanceof Timestamp) return v.toDate().toISOString();
    return v as string;
  };
  return {
    id,
    projectId: data.projectId as string,
    title: data.title as string,
    description: data.description as string,
    assignedTo: data.assignedTo as string,
    createdBy: data.createdBy as string,
    priority: data.priority as TaskPriority,
    status: data.status as TaskStatus,
    deadline: data.deadline as string,
    completedAt: toISO(data.completedAt) as string | null,
    completionPercent: typeof data.completionPercent === 'number' ? data.completionPercent : 0,
    createdAt: toISO(data.createdAt) as string,
    updatedAt: toISO(data.updatedAt) as string,
  };
}

/** Get a single task by ID */
export async function getTaskById(taskId: string): Promise<Task | null> {
  const snap = await getDoc(doc(db, COLLECTION, taskId));
  if (!snap.exists()) return null;
  return toTask(snap.data() as Record<string, unknown>, snap.id);
}

/** Get all tasks for a project */
export async function getTasksByProject(projectId: string): Promise<Task[]> {
  const q = query(collection(db, COLLECTION), where('projectId', '==', projectId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toTask(d.data() as Record<string, unknown>, d.id));
}

/** Get all tasks assigned to a specific user */
export async function getTasksByAssignee(userId: string): Promise<Task[]> {
  const q = query(collection(db, COLLECTION), where('assignedTo', '==', userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toTask(d.data() as Record<string, unknown>, d.id));
}

/**
 * Get all tasks assigned to a user within a date range.
 * Filters by deadline field falling within [from, to] (ISO strings).
 */
export async function getTasksByAssigneeInRange(
  userId: string,
  from: string,
  to: string
): Promise<Task[]> {
  const q = query(collection(db, COLLECTION), where('assignedTo', '==', userId));
  const snap = await getDocs(q);
  const all = snap.docs.map((d) => toTask(d.data() as Record<string, unknown>, d.id));
  // Filter by createdAt in range
  return all.filter((t) => {
    const created = t.createdAt ? new Date(t.createdAt).getTime() : 0;
    return created >= new Date(from).getTime() && created <= new Date(to).getTime();
  });
}

/** Create a new task (Team Lead only) */
export async function createTask(params: {
  projectId: string;
  title: string;
  description: string;
  assignedTo: string;
  createdBy: string;
  priority: TaskPriority;
  deadline: string;
}): Promise<Task> {
  const { projectId, title, description, assignedTo, createdBy, priority, deadline } = params;
  const docRef = await addDoc(collection(db, COLLECTION), {
    projectId,
    title,
    description,
    assignedTo,
    createdBy,
    priority,
    status: 'TODO' as TaskStatus,
    deadline,
    completedAt: null,
    completionPercent: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(docRef, { id: docRef.id });
  const isoNow = new Date().toISOString();
  return {
    id: docRef.id,
    projectId,
    title,
    description,
    assignedTo,
    createdBy,
    priority,
    status: 'TODO',
    deadline,
    completedAt: null,
    completionPercent: 0,
    createdAt: isoNow,
    updatedAt: isoNow,
  };
}

/**
 * Record a progress change history log
 */
export async function recordProgressHistory(params: {
  taskId: string;
  previousProgress: number;
  newProgress: number;
  previousStatus: TaskStatus;
  newStatus: TaskStatus;
  updatedBy: string;
}): Promise<void> {
  const historyRef = doc(collection(db, 'taskProgressHistory'));
  await setDoc(historyRef, {
    ...params,
    id: historyRef.id,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get all progress history logs for a specific task
 */
export async function getTaskProgressHistory(taskId: string): Promise<any[]> {
  const q = query(collection(db, 'taskProgressHistory'), where('taskId', '==', taskId));
  const snap = await getDocs(q);
  const toISO = (v: any) => (v instanceof Timestamp ? v.toDate().toISOString() : v as string);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      taskId: data.taskId,
      previousProgress: data.previousProgress,
      newProgress: data.newProgress,
      previousStatus: data.previousStatus,
      newStatus: data.newStatus,
      updatedBy: data.updatedBy,
      updatedAt: toISO(data.updatedAt),
    };
  });
}

/**
 * Get all progress history logs
 */
export async function getAllProgressHistory(): Promise<any[]> {
  const snap = await getDocs(collection(db, 'taskProgressHistory'));
  const toISO = (v: any) => (v instanceof Timestamp ? v.toDate().toISOString() : v as string);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      taskId: data.taskId,
      previousProgress: data.previousProgress,
      newProgress: data.newProgress,
      previousStatus: data.previousStatus,
      newStatus: data.newStatus,
      updatedBy: data.updatedBy,
      updatedAt: toISO(data.updatedAt),
    };
  });
}

/**
 * Update task status.
 * - COMPLETED: set completedAt = now, completionPercent = 100
 * - Other: clear completedAt, preserve completionPercent
 */
export async function updateTaskStatus(taskId: string, newStatus: TaskStatus, updatedBy: string): Promise<void> {
  const taskRef = doc(db, COLLECTION, taskId);
  const snap = await getDoc(taskRef);
  if (!snap.exists()) return;
  const currentTask = toTask(snap.data() as Record<string, unknown>, snap.id);

  const updates: Record<string, unknown> = { status: newStatus, updatedAt: serverTimestamp() };
  let newProgress = currentTask.completionPercent;

  if (newStatus === 'COMPLETED') {
    updates.completedAt = serverTimestamp();
    updates.completionPercent = 100;
    newProgress = 100;
  } else {
    updates.completedAt = null;
  }

  // Record history
  await recordProgressHistory({
    taskId,
    previousProgress: currentTask.completionPercent,
    newProgress,
    previousStatus: currentTask.status,
    newStatus,
    updatedBy,
  });

  await updateDoc(taskRef, updates);
}

/** Update editable task fields (Team Lead / Team Member for completionPercent) */
export async function updateTask(
  taskId: string,
  updates: Partial<Pick<Task, 'title' | 'description' | 'assignedTo' | 'priority' | 'deadline' | 'completionPercent'>>,
  updatedBy: string
): Promise<void> {
  const taskRef = doc(db, COLLECTION, taskId);
  
  if (typeof updates.completionPercent === 'number') {
    const snap = await getDoc(taskRef);
    if (snap.exists()) {
      const currentTask = toTask(snap.data() as Record<string, unknown>, snap.id);
      await recordProgressHistory({
        taskId,
        previousProgress: currentTask.completionPercent,
        newProgress: updates.completionPercent,
        previousStatus: currentTask.status,
        newStatus: currentTask.status,
        updatedBy,
      });
    }
  }

  await updateDoc(taskRef, { ...updates, updatedAt: serverTimestamp() });
}

/** Delete a task (Team Lead only) */
export async function deleteTask(taskId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, taskId));
}
