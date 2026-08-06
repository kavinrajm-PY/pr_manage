// src/services/notifications.ts
// Firestore service for managing notifications

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import { Notification, NotificationType } from '@/types';

const COLLECTION = 'notifications';

function toNotification(data: Record<string, unknown>, id: string): Notification {
  const toISO = (v: unknown) =>
    v instanceof Timestamp ? v.toDate().toISOString() : (v as string) ?? '';
  return {
    id,
    userId: data.userId as string,
    type: data.type as NotificationType,
    title: data.title as string,
    message: data.message as string,
    link: data.link as string,
    isRead: !!data.isRead,
    createdAt: toISO(data.createdAt),
  };
}

/** Create a new notification for a specific user */
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
}): Promise<Notification> {
  const { userId, type, title, message, link } = params;
  const now = serverTimestamp();

  const docRef = await addDoc(collection(db, COLLECTION), {
    userId,
    type,
    title,
    message,
    link,
    isRead: false,
    createdAt: now,
  });

  const isoNow = new Date().toISOString();
  return {
    id: docRef.id,
    userId,
    type,
    title,
    message,
    link,
    isRead: false,
    createdAt: isoNow,
  };
}

/** Get the most recent 20 notifications for a user */
export async function getUserNotifications(userId: string): Promise<Notification[]> {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId)
  );
  
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => toNotification(d.data() as Record<string, unknown>, d.id));
  
  // Sort in memory by createdAt descending to avoid composite index requirements
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Mark a single notification as read */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, notificationId), {
    isRead: true,
  });
}

/** Mark all notifications as read for a user */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId),
    where('isRead', '==', false)
  );

  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { isRead: true });
  });

  await batch.commit();
}

/** Delete a single notification */
export async function deleteNotification(notificationId: string): Promise<void> {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, COLLECTION, notificationId));
}

/** Delete all notifications for a user */
export async function clearAllNotifications(userId: string): Promise<void> {
  const { deleteDoc } = await import('firebase/firestore');
  const q = query(
    collection(db, COLLECTION),
    where('userId', '==', userId)
  );
  
  const snap = await getDocs(q);
  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.delete(d.ref);
  });
  await batch.commit();
}
