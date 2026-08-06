// src/services/comments.ts
// Firestore CRUD for the 'comments' collection

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import { Comment } from '@/types';

const COLLECTION = 'comments';

function toComment(data: Record<string, unknown>, id: string): Comment {
  const toISO = (v: unknown) =>
    v instanceof Timestamp ? v.toDate().toISOString() : (v as string) ?? '';
  return {
    id,
    taskId: data.taskId as string,
    userId: data.userId as string,
    comment: data.comment as string,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
  };
}

/** Get all comments for a task, ordered by createdAt ascending */
export async function getCommentsByTask(taskId: string): Promise<Comment[]> {
  const q = query(
    collection(db, COLLECTION),
    where('taskId', '==', taskId)
  );
  const snap = await getDocs(q);
  const comments = snap.docs.map((d) =>
    toComment(d.data() as Record<string, unknown>, d.id)
  );
  // Sort in memory by createdAt ascending
  return comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/** Add a comment to a task */
export async function addComment(params: {
  taskId: string;
  userId: string;
  comment: string;
}): Promise<Comment> {
  const { taskId, userId, comment } = params;
  const now = serverTimestamp();

  const docRef = await addDoc(collection(db, COLLECTION), {
    taskId,
    userId,
    comment,
    createdAt: now,
    updatedAt: now,
  });

  const isoNow = new Date().toISOString();
  return {
    id: docRef.id,
    taskId,
    userId,
    comment,
    createdAt: isoNow,
    updatedAt: isoNow,
  };
}

/** Edit an existing comment */
export async function editComment(
  commentId: string,
  newText: string
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, commentId), {
    comment: newText,
    updatedAt: serverTimestamp(),
  });
}
