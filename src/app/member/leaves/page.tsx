'use client';

// src/app/member/leaves/page.tsx
// Team Member view for managing their leave requests.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/AuthContext';
import { createLeaveRequest, getLeaveRequestsByUser } from '@/services/leaveRequests';
import { createNotification } from '@/services/notifications';
import { getUsersByRole } from '@/services/users';
import { LeaveRequest, LeaveStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Plus, Clock, CheckCircle, XCircle, MessageSquare, ShieldAlert } from 'lucide-react';
import { formatDate } from '@/lib/utils/dates';

function statusBadge(status: LeaveStatus) {
  if (status === 'APPROVED') return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-300">Approved</Badge>;
  if (status === 'REJECTED') return <Badge className="bg-rose-500/15 text-rose-600 border-rose-300">Rejected</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-600 border-amber-300">Pending</Badge>;
}

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
}

export default function MemberLeavesPage() {
  const { role, firebaseUser, userProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!loading && role !== 'TEAM_MEMBER') router.push('/login');
  }, [role, loading, router]);

  useEffect(() => {
    if (!firebaseUser || role !== 'TEAM_MEMBER') return;
    getLeaveRequestsByUser(firebaseUser.uid)
      .then(setLeaves)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [firebaseUser, role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser || !userProfile) return;
    const todayStr = new Date().toISOString().split('T')[0];
    if (startDate <= todayStr) {
      toast({ title: 'Validation Error', description: 'Start date must be tomorrow or later.', variant: 'destructive' });
      return;
    }
    if (endDate < startDate) {
      toast({ title: 'Validation Error', description: 'End date must be on or after start date.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const computedDays = calcDays(startDate, endDate);
      const newLeave = await createLeaveRequest({
        userId: firebaseUser.uid,
        userName: userProfile.name,
        userEmail: userProfile.email,
        reason: reason.trim(),
        startDate,
        endDate,
        days: computedDays,
      });
      setLeaves((prev) => [newLeave, ...prev]);
      setShowForm(false);
      setStartDate(''); setEndDate(''); setReason('');
      toast({ title: 'Leave Request Submitted', description: 'Your request has been sent to the Project Manager.' });

      // Notify all Project Managers
      getUsersByRole('PROJECT_MANAGER')
        .then((pms) => {
          pms.forEach((pm) => {
            createNotification({
              userId: pm.id,
              type: 'LEAVE_REQUESTED',
              title: 'New Leave Request Received',
              message: `${userProfile.name} requested leave for ${computedDays} day(s) (${startDate} to ${endDate}).`,
              link: '/leaves',
            }).catch(console.error);
          });
        })
        .catch(console.error);

    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to submit request.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (role !== 'TEAM_MEMBER') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-2">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-xl font-bold">Access Denied</h2>
        </div>
      </AppLayout>
    );
  }

  const approvedDays = leaves.filter(l => l.status === 'APPROVED').reduce((sum, l) => sum + l.days, 0);
  const pending = leaves.filter(l => l.status === 'PENDING').length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">My Leave Requests</h1>
          </div>
          <Button onClick={() => setShowForm((v) => !v)} className="gap-2">
            <Plus className="h-4 w-4" /> {showForm ? 'Cancel' : 'Request Leave'}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-emerald-500">{approvedDays}</p>
            <p className="text-xs text-muted-foreground mt-1">Approved Days</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-amber-500">{pending}</p>
            <p className="text-xs text-muted-foreground mt-1">Pending</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{leaves.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total Requests</p>
          </CardContent></Card>
        </div>

        {/* Request Form Popup Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => setShowForm(false)}
            />

            {/* Modal Content */}
            <Card className="relative w-full max-w-lg border border-primary/20 bg-background shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10">
              <CardHeader className="pb-4 bg-muted/40 border-b">
                <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
                  <CalendarDays className="h-5.5 w-5.5 text-primary" /> Submit Leave Request
                </CardTitle>
                <CardDescription>Select start and end dates and state your reason below.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/20 rounded-xl border border-muted-foreground/10">
                    <div className="space-y-2">
                      <Label htmlFor="start-date" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Start Date *</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                        required
                        className="h-11 focus-visible:ring-2 focus-visible:ring-primary/40 font-medium bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">End Date *</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate || new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                        required
                        className="h-11 focus-visible:ring-2 focus-visible:ring-primary/40 font-medium bg-background"
                      />
                    </div>
                  </div>

                  {startDate && endDate && new Date(endDate) >= new Date(startDate) && (
                    <div className="px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-semibold border border-emerald-100 flex items-center justify-between shadow-sm">
                      <span>Total Duration:</span>
                      <span className="text-base font-black">{calcDays(startDate, endDate)} day(s)</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="reason" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Reason for Leave *</Label>
                    <Textarea
                      id="reason"
                      placeholder="Explain why you need this leave..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      required
                      className="focus-visible:ring-2 focus-visible:ring-primary/40 text-sm p-3 rounded-lg"
                    />
                  </div>

                  <div className="flex gap-3 justify-end pt-3 border-t">
                    <Button type="button" variant="outline" className="h-11 px-6 font-semibold" onClick={() => setShowForm(false)}>Cancel</Button>
                    <Button type="submit" className="h-11 px-6 font-semibold" disabled={submitting}>
                      {submitting ? 'Submitting…' : 'Submit Request'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Leave History */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold">Request History</h2>
          {leaves.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No leave requests submitted yet.</CardContent></Card>
          ) : (
            leaves.map((leave) => (
              <Card key={leave.id} className="overflow-hidden">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">{formatDate(leave.startDate)} → {formatDate(leave.endDate)}</span>
                        <span className="text-xs text-muted-foreground">({leave.days} day{leave.days !== 1 ? 's' : ''})</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{leave.reason}</p>
                      {leave.pmComment && (
                        <div className="flex items-start gap-1.5 mt-2 text-xs bg-muted/40 rounded p-2">
                          <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
                          <span className="text-muted-foreground"><span className="font-semibold">PM:</span> {leave.pmComment}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0">{statusBadge(leave.status)}</div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}
