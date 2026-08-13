// src/services/projectMembers.ts
// Firestore CRUD for the 'projectMembers' collection

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import { ProjectMember, UserRole } from '@/types';

const COLLECTION = 'projectMembers';

function toMember(data: Record<string, unknown>, id: string): ProjectMember {
  const toISO = (v: unknown) =>
    v instanceof Timestamp ? v.toDate().toISOString() : (v as string) ?? '';
  return {
    id,
    projectId: data.projectId as string,
    userId: data.userId as string,
    role: data.role as UserRole,
    addedAt: toISO(data.addedAt),
  };
}

/** Get all members for a project */
export async function getProjectMembers(
  projectId: string
): Promise<ProjectMember[]> {
  const q = query(
    collection(db, COLLECTION),
    where('projectId', '==', projectId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    toMember(d.data() as Record<string, unknown>, d.id)
  );
}

/** Get all project memberships for a user */
export async function getMembershipsByUser(
  userId: string
): Promise<ProjectMember[]> {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) =>
    toMember(d.data() as Record<string, unknown>, d.id)
  );
}

/** Get project IDs for a given user */
export async function getProjectIdsByUser(userId: string): Promise<string[]> {
  const memberships = await getMembershipsByUser(userId);
  return memberships.map((m) => m.projectId);
}

/** Add a member to a project */
export async function addProjectMember(params: {
  projectId: string;
  userId: string;
  role: UserRole;
}): Promise<ProjectMember> {
  const { projectId, userId, role } = params;
  const docId = `membership_${projectId}_${userId}`;
  const docRef = doc(db, COLLECTION, docId);
  
  await setDoc(docRef, {
    projectId,
    userId,
    role,
    addedAt: serverTimestamp(),
  });

  const isoNow = new Date().toISOString();
  return {
    id: docId,
    projectId,
    userId,
    role,
    addedAt: isoNow,
  };
}

/** Remove a member from a project by membership document ID */
export async function removeProjectMember(membershipId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, membershipId));
}

/** Remove a specific user from a project */
export async function removeUserFromProject(
  projectId: string,
  userId: string
): Promise<void> {
  const q = query(
    collection(db, COLLECTION),
    where('projectId', '==', projectId),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

/** Check if a user is a member of a project */
export async function isProjectMember(
  projectId: string,
  userId: string
): Promise<boolean> {
  const q = query(
    collection(db, COLLECTION),
    where('projectId', '==', projectId),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/** Get project members for multiple project IDs in chunks of 30 */
export async function getProjectMembersByProjects(projectIds: string[]): Promise<ProjectMember[]> {
  if (projectIds.length === 0) return [];
  
  const chunks: string[][] = [];
  const chunkSize = 30;
  for (let i = 0; i < projectIds.length; i += chunkSize) {
    chunks.push(projectIds.slice(i, i + chunkSize));
  }

  const results: ProjectMember[] = [];
  await Promise.all(
    chunks.map(async (chunk) => {
      const q = query(
        collection(db, COLLECTION),
        where('projectId', 'in', chunk)
      );
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        results.push(toMember(d.data() as Record<string, unknown>, d.id));
      });
    })
  );
  return results;
}

