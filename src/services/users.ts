// src/services/users.ts
// Firestore CRUD for the 'users' collection
// Also handles creating Firebase Auth users via the secondary app

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp,
  Timestamp,
  documentId,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import { createAuthUser } from '@/lib/firebase/auth';
import { User, UserRole } from '@/types';

const COLLECTION = 'users';

function toUser(data: Record<string, unknown>, id: string): User {
  const toISO = (v: unknown) =>
    v instanceof Timestamp ? v.toDate().toISOString() : (v as string) ?? '';
  return {
    id,
    name: data.name as string,
    email: data.email as string,
    role: data.role as UserRole,
    profileImage: data.profileImage as string | undefined,
    isActive: data.isActive as boolean,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
  };
}

/** Get a single user by UID */
export async function getUserById(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;
  return toUser(snap.data() as Record<string, unknown>, snap.id);
}

/** Get all users */
export async function getAllUsers(): Promise<User[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => toUser(d.data() as Record<string, unknown>, d.id));
}

/** Get all users with a specific role */
export async function getUsersByRole(role: UserRole): Promise<User[]> {
  const q = query(collection(db, COLLECTION), where('role', '==', role));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toUser(d.data() as Record<string, unknown>, d.id));
}

/** Get users by IDs (for enriching project members) */
export async function getUsersByIds(uids: string[]): Promise<User[]> {
  if (uids.length === 0) return [];
  
  const chunks: string[][] = [];
  const chunkSize = 30;
  for (let i = 0; i < uids.length; i += chunkSize) {
    chunks.push(uids.slice(i, i + chunkSize));
  }

  const results: User[] = [];
  await Promise.all(
    chunks.map(async (chunk) => {
      const q = query(
        collection(db, COLLECTION),
        where(documentId(), 'in', chunk)
      );
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        results.push(toUser(d.data() as Record<string, unknown>, d.id));
      });
    })
  );
  return results;
}

/**
 * Create a new user:
 * 1. Creates the Firebase Auth account (secondary app, no sign-out)
 * 2. Writes the Firestore 'users' document using the new UID
 */
export async function createUser(params: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<User> {
  const { name, email, password, role } = params;

  // Step 1: Create Firebase Auth user
  const uid = await createAuthUser(email, password);

  // Step 2: Create Firestore document
  const now = serverTimestamp();
  const userData = {
    id: uid,
    name,
    email,
    role,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(doc(db, COLLECTION, uid), userData);

  // Return a plain User object (timestamps approximated for immediate use)
  const isoNow = new Date().toISOString();
  return {
    id: uid,
    name,
    email,
    role,
    isActive: true,
    createdAt: isoNow,
    updatedAt: isoNow,
  };
}

/** Update a user document */
export async function updateUser(
  uid: string,
  updates: Partial<Pick<User, 'name' | 'role' | 'isActive'>>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, uid), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}
