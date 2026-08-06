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
  const q = query(
    collection(db, COLLECTION),
    where('projectId', '==', projectId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    toTask(d.data() as Record<string, unknown>, d.id)
  );
}

/** Get all tasks assigned to a specific user */
export async function getTasksByAssignee(userId: string): Promise<Task[]> {
  const q = query(
    collection(db, COLLECTION),
    where('assignedTo', '==', userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    toTask(d.data() as Record<string, unknown>, d.id)
  );
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
  const { projectId, title, description, assignedTo, createdBy, priority, deadline } =
    params;

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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Write the id field into the document
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
    createdAt: isoNow,
    updatedAt: isoNow,
  };
}

/**
 * Update task status.
 * - When status becomes COMPLETED: set completedAt = now
 * - When changed away from COMPLETED: clear completedAt
 */
export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus
): Promise<void> {
  const updates: Record<string, unknown> = {
    status: newStatus,
    updatedAt: serverTimestamp(),
  };

  if (newStatus === 'COMPLETED') {
    updates.completedAt = serverTimestamp();
  } else {
    updates.completedAt = null;
  }

  await updateDoc(doc(db, COLLECTION, taskId), updates);
}

/** Update editable task fields (Team Lead) */
export async function updateTask(
  taskId: string,
  updates: Partial<
    Pick<Task, 'title' | 'description' | 'assignedTo' | 'priority' | 'deadline'>
  >
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, taskId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}
