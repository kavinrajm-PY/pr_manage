'use client';

// src/app/notifications/page.tsx
// Screen displaying all notifications, allowing users to clear them or mark them as read.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/AuthContext';
import { Notification } from '@/types';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';
import {
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotifications,
} from '@/services/notifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Bell, Trash2, CheckCircle2, Sparkles, Folder, CheckSquare, MessageSquare, Flame } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

function getNotificationIcon(type: string) {
  switch (type) {
    case 'PROJECT_ASSIGNED':
      return <Folder className="h-5 w-5 text-sky-500" />;
    case 'TASK_ASSIGNED':
      return <CheckSquare className="h-5 w-5 text-emerald-500" />;
    case 'COMMENT_ADDED':
      return <MessageSquare className="h-5 w-5 text-indigo-500" />;
    case 'STATUS_UPDATED':
      return <Flame className="h-5 w-5 text-amber-500" />;
    default:
      return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
}

export default function NotificationsPage() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !firebaseUser) {
      router.push('/login');
    }
  }, [firebaseUser, authLoading, router]);

  useEffect(() => {
    if (!firebaseUser) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', firebaseUser.uid)
    );

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

      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(list);
      setLoading(false);
    }, (error) => {
      console.error('Error loading notifications', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function handleNotificationClick(n: Notification) {
    if (!n.isRead) {
      await markNotificationAsRead(n.id);
    }
    router.push(n.link);
  }

  async function handleDeleteClick(e: React.MouseEvent, id: string) {
    e.stopPropagation(); // prevent navigating to notification link
    try {
      await deleteNotification(id);
      toast({
        title: 'Cleared',
        description: 'Notification cleared successfully.',
      });
    } catch (error) {
      console.error('Failed to clear notification', error);
    }
  }

  async function handleMarkAllRead() {
    if (!firebaseUser) return;
    try {
      await markAllNotificationsAsRead(firebaseUser.uid);
      toast({
        title: 'Updated',
        description: 'All notifications marked as read.',
      });
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  }

  async function handleClearAll() {
    if (!firebaseUser) return;
    try {
      await clearAllNotifications(firebaseUser.uid);
      toast({
        title: 'Cleared All',
        description: 'All notifications have been cleared.',
      });
    } catch (error) {
      console.error('Failed to clear all notifications', error);
    }
  }

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Bell className="h-7 w-7 text-primary" /> Notifications
            </h1>
            <p className="text-muted-foreground">
              Manage your project updates, task status shifts, and comments.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-1.5 text-xs font-semibold">
                <CheckCircle2 className="h-4 w-4" /> Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="destructive" size="sm" onClick={handleClearAll} className="gap-1.5 text-xs font-semibold">
                <Trash2 className="h-4 w-4" /> Clear all
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-yellow-500" /> Recent Updates ({notifications.length})
            </CardTitle>
            <CardDescription>
              Notifications will stay here until you clear them. Click on any item to view task details.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground border-t">
                <Bell className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                <h3 className="font-semibold text-lg">No notifications</h3>
                <p className="text-sm">You are completely up to date!</p>
              </div>
            ) : (
              <div className="divide-y border-t bg-card text-card-foreground">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex items-start gap-4 p-4 hover:bg-muted/40 transition-colors cursor-pointer group relative ${
                      !n.isRead ? 'bg-primary/5 dark:bg-primary/10 font-semibold' : ''
                    }`}
                  >
                    <div className="mt-0.5 rounded-full p-2 bg-muted dark:bg-muted/50">
                      {getNotificationIcon(n.type)}
                    </div>
                    <div className="flex-1 space-y-1 min-w-0 pr-12">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-foreground">{n.title}</span>
                        {!n.isRead && (
                          <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold px-1.5 py-0.5 rounded-full">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed break-words">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                        on {new Date(n.createdAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDeleteClick(e, n.id)}
                      className="absolute right-4 top-4 h-8 w-8 text-muted-foreground hover:text-destructive transition-colors rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                      title="Clear notification"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Clear notification</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
