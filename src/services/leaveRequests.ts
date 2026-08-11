// src/services/leaveRequests.ts
// Firestore CRUD for the 'leaveRequests' collection

import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import { LeaveRequest, LeaveStatus } from '@/types';

const COLLECTION = 'leaveRequests';

function toLeaveRequest(data: Record<string, unknown>, id: string): LeaveRequest {
  const toISO = (v: unknown): string => {
    if (!v) return '';
    if (v instanceof Timestamp) return v.toDate().toISOString();
    return v as string;
  };
  return {
    id,
    userId: data.userId as string,
    userName: data.userName as string,
    userEmail: data.userEmail as string,
    reason: data.reason as string,
    startDate: data.startDate as string,
    endDate: data.endDate as string,
    days: typeof data.days === 'number' ? data.days : 0,
    status: (data.status as LeaveStatus) || 'PENDING',
    pmComment: (data.pmComment as string) || '',
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
  };
}

/** Create a new leave request (Team Member only) */
export async function createLeaveRequest(params: {
  userId: string;
  userName: string;
  userEmail: string;
  reason: string;
  startDate: string;
  endDate: string;
  days: number;
}): Promise<LeaveRequest> {
  // Pre-generate doc to avoid secondary update permission errors
  const docRef = doc(collection(db, COLLECTION));
  const isoNow = new Date().toISOString();
  
  await setDoc(docRef, {
    ...params,
    id: docRef.id,
    status: 'PENDING' as LeaveStatus,
    pmComment: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    ...params,
    id: docRef.id,
    status: 'PENDING',
    pmComment: '',
    createdAt: isoNow,
    updatedAt: isoNow,
  };
}

/** Get all leave requests for a specific user */
export async function getLeaveRequestsByUser(userId: string): Promise<LeaveRequest[]> {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => toLeaveRequest(d.data() as Record<string, unknown>, d.id));
  // Sort in memory to avoid composite index requirements
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Get all leave requests (PM only) */
export async function getAllLeaveRequests(): Promise<LeaveRequest[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  const items = snap.docs.map((d) => toLeaveRequest(d.data() as Record<string, unknown>, d.id));
  // Sort in memory to avoid index requirements
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Get approved leaves for a user within a date range (for reports) */
export async function getApprovedLeavesInRange(
  userId: string,
  from: string,
  to: string
): Promise<LeaveRequest[]> {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    where('status', '==', 'APPROVED')
  );
  const snap = await getDocs(q);
  const all = snap.docs.map((d) => toLeaveRequest(d.data() as Record<string, unknown>, d.id));
  return all.filter((lr) => {
    const start = new Date(lr.startDate).getTime();
    const fromTs = new Date(from).getTime();
    const toTs = new Date(to).getTime();
    return start >= fromTs && start <= toTs;
  });
}

/** Update leave request status and optional PM comment */
export async function updateLeaveRequest(
  id: string,
  updates: { status: LeaveStatus; pmComment?: string }
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}
