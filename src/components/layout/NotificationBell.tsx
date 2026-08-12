'use client';

// src/components/layout/NotificationBell.tsx
// Real-time notification subscriber and dropdown list UI component.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CircleAlert, Sparkles, Folder, CheckSquare, MessageSquare, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth/AuthContext';
import { Notification } from '@/types';
import { collection, query, where, onSnapshot, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import { markNotificationAsRead, markAllNotificationsAsRead } from '@/services/notifications';
import { toast } from '@/components/ui/toast';

function getNotificationIcon(type: string) {
  switch (type) {
    case 'PROJECT_ASSIGNED':
      return <Folder className="h-4 w-4 text-sky-500" />;
    case 'TASK_ASSIGNED':
      return <CheckSquare className="h-4 w-4 text-emerald-500" />;
    case 'COMMENT_ADDED':
      return <MessageSquare className="h-4 w-4 text-indigo-500" />;
    case 'STATUS_UPDATED':
      return <Flame className="h-4 w-4 text-amber-500" />;
    default:
      return <CircleAlert className="h-4 w-4 text-muted-foreground" />;
  }
}

export function NotificationBell() {
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;

    // Real-time listener for user notifications
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', firebaseUser.uid)
    );

    let isInitial = true;
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Notification[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const toISO = (v: unknown) =>
          v instanceof Timestamp ? v.toDate().toISOString() : (v as string) ?? '';
        list.push({
          id: doc.id,
          userId: data.userId as string,
          type: data.type as any,
          title: data.title as string,
          message: data.message as string,
          link: data.link as string,
          isRead: !!data.isRead,
          createdAt: toISO(data.createdAt),
        });
      });

      // Sort in-memory to prevent indexing issues
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(list);

      if (!isInitial) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            toast.add({
              title: data.title || 'New Notification',
              description: data.message || '',
              type: 'info',
              data: {
                onClick: () => verifyAndNavigate(data.link || ''),
              },
            });
          }
        });
      } else {
        isInitial = false;
      }
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function verifyAndNavigate(link: string) {
    if (!link) return;
    const matchTask = link.match(/\/tasks\/([^/]+)/);
    const matchProject = link.match(/\/projects\/([^/]+)/) || link.match(/\/lead\/projects\/([^/]+)/) || link.match(/\/member\/projects\/([^/]+)/);

    let exists = true;
    try {
      if (matchTask) {
        const taskId = matchTask[1];
        const docSnap = await getDoc(doc(db, 'tasks', taskId));
        if (!docSnap.exists()) {
          exists = false;
        }
      } else if (matchProject) {
        const projectId = matchProject[1];
        const docSnap = await getDoc(doc(db, 'projects', projectId));
        if (!docSnap.exists()) {
          exists = false;
        }
      }
    } catch (err) {
      console.error('Error verifying document existence', err);
      exists = false;
    }

    if (exists) {
      router.push(link);
    } else {
      toast.add({
        title: 'Action Not Found',
        description: 'Action not found, kindly refresh.',
        type: 'error',
      });
    }
  }

  async function handleNotificationClick(n: Notification) {
    setOpen(false);
    if (!n.isRead) {
      await markNotificationAsRead(n.id);
    }
    await verifyAndNavigate(n.link);
  }

  async function handleMarkAllRead() {
    if (!firebaseUser) return;
    await markAllNotificationsAsRead(firebaseUser.uid);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger className="relative h-9 w-9 rounded-full hover:bg-muted transition-colors flex items-center justify-center cursor-pointer border-0 outline-none">
        <Bell className="h-5 w-5 text-foreground" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1.5 -right-1.5 h-5 w-5 flex items-center justify-center p-0 text-[10px] font-bold border-2 border-background animate-pulse"
          >
            {unreadCount}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 sm:w-96 mr-4 align-end max-h-[32rem] overflow-y-auto" align="end">
        <div className="flex items-center justify-between p-2">
          <span className="font-bold flex items-center gap-1.5 text-sm px-1.5 py-1 text-foreground">
            <Sparkles className="h-4 w-4 text-yellow-500" /> Notifications
          </span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-xs h-7 text-muted-foreground hover:text-foreground font-medium"
            >
              Mark all as read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="py-1">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Bell className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p>You have no notifications yet.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-3 cursor-pointer flex gap-3 focus:bg-muted border-b border-muted/30 last:border-0 ${
                  !n.isRead ? 'bg-primary/5 dark:bg-primary/10 font-medium' : ''
                }`}
              >
                <div className="mt-0.5 rounded-full p-1.5 bg-muted dark:bg-muted/50 h-fit">
                  {getNotificationIcon(n.type)}
                </div>
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold text-foreground leading-none">{n.title}</p>
                    {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                    on {new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-1.5 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  router.push('/notifications');
                }}
                className="w-full text-xs font-semibold text-primary hover:text-primary-foreground hover:bg-primary transition-colors h-8"
              >
                View all notifications
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
