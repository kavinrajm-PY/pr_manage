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

/** Delete a project and its document (PM only) */
export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
