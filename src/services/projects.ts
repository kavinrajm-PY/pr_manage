// src/services/projects.ts
// Firestore CRUD for the 'projects' collection

import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import { Project, ProjectStatus } from '@/types';

const COLLECTION = 'projects';

function toProject(data: Record<string, unknown>, id: string): Project {
  const toISO = (v: unknown) =>
    v instanceof Timestamp ? v.toDate().toISOString() : (v as string) ?? '';
  return {
    id,
    name: data.name as string,
    description: data.description as string,
    status: data.status as ProjectStatus,
    startDate: data.startDate as string,
    deadline: data.deadline as string,
    createdBy: data.createdBy as string,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
  };
}

/** Get a single project by ID */
export async function getProjectById(id: string): Promise<Project | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return toProject(snap.data() as Record<string, unknown>, snap.id);
}

/** Get all projects (PM only) */
export async function getAllProjects(): Promise<Project[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) =>
    toProject(d.data() as Record<string, unknown>, d.id)
  );
}

/** Get projects where a specific user is the creator (PM) */
export async function getProjectsByCreator(uid: string): Promise<Project[]> {
  const q = query(collection(db, COLLECTION), where('createdBy', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    toProject(d.data() as Record<string, unknown>, d.id)
  );
}

/** Create a new project. Returns the newly created Project with its ID. */
export async function createProject(params: {
  name: string;
  description: string;
  startDate: string;
  deadline: string;
  createdBy: string;
}): Promise<Project> {
  const { name, description, startDate, deadline, createdBy } = params;
  const docRef = await addDoc(collection(db, COLLECTION), {
    name,
    description,
    status: 'NOT_STARTED' as ProjectStatus,
    startDate,
    deadline,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Set the id field inside the document
  await updateDoc(docRef, { id: docRef.id });

  const isoNow = new Date().toISOString();
  return {
    id: docRef.id,
    name,
    description,
    status: 'NOT_STARTED',
    startDate,
    deadline,
    createdBy,
    createdAt: isoNow,
    updatedAt: isoNow,
  };
}

/** Update project fields */
export async function updateProject(
  id: string,
  updates: Partial<Pick<Project, 'name' | 'description' | 'status' | 'startDate' | 'deadline'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/** Delete a project and its document, along with its tasks, comments, progress history, and memberships (PM only) */
export async function deleteProject(projectId: string): Promise<void> {
  // 1. Fetch all tasks for this project
  const tasksQ = query(collection(db, 'tasks'), where('projectId', '==', projectId));
  const tasksSnap = await getDocs(tasksQ);
  const taskIds = tasksSnap.docs.map((d) => d.id);

  const deletePromises: Promise<void>[] = [];

  if (taskIds.length > 0) {
    // 2. Fetch and delete comments and progress history for all tasks
    for (const taskId of taskIds) {
      const commentsQ = query(collection(db, 'comments'), where('taskId', '==', taskId));
      const commentsSnap = await getDocs(commentsQ);
      commentsSnap.docs.forEach((d) => {
        deletePromises.push(deleteDoc(d.ref));
      });

      const historyQ = query(collection(db, 'taskProgressHistory'), where('taskId', '==', taskId));
      const historySnap = await getDocs(historyQ);
      historySnap.docs.forEach((d) => {
        deletePromises.push(deleteDoc(d.ref));
      });
    }

    // Delete the task documents
    tasksSnap.docs.forEach((d) => {
      deletePromises.push(deleteDoc(d.ref));
    });
  }

  // 3. Get all project memberships and delete them
  const membershipsQ = query(collection(db, 'projectMembers'), where('projectId', '==', projectId));
  const membershipsSnap = await getDocs(membershipsQ);
  membershipsSnap.docs.forEach((d) => {
    deletePromises.push(deleteDoc(d.ref));
  });

  // Run all cascading deletions in parallel
  await Promise.all(deletePromises);

  // 4. Finally, delete the project document itself
  await deleteDoc(doc(db, COLLECTION, projectId));
}
