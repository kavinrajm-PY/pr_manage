'use client';

// src/app/leaves/page.tsx
// Project Manager view for all leave requests.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/AuthContext';
import { getAllLeaveRequests, updateLeaveRequest } from '@/services/leaveRequests';
import { createNotification } from '@/services/notifications';
import { LeaveRequest, LeaveStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, CheckCircle, XCircle, Clock, ShieldAlert, Users } from 'lucide-react';
import { formatDate } from '@/lib/utils/dates';

function statusBadge(status: LeaveStatus) {
  if (status === 'APPROVED') return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-300">Approved</Badge>;
  if (status === 'REJECTED') return <Badge className="bg-rose-500/15 text-rose-600 border-rose-300">Rejected</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-600 border-amber-300">Pending</Badge>;
}

export default function LeaveRequestsPage() {
  const { role } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [updating, setUpdating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<LeaveStatus | 'ALL'>('ALL');

  useEffect(() => {
    if (!loading && role !== 'PROJECT_MANAGER') router.push('/login');
  }, [role, loading, router]);

  useEffect(() => {
    if (role !== 'PROJECT_MANAGER') return;
    getAllLeaveRequests()
      .then(setLeaves)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [role]);

  async function handleDecision(id: string, status: LeaveStatus) {
    const leaveItem = leaves.find((l) => l.id === id);
    if (!leaveItem) return;

    setUpdating(true);
    try {
      const pmComment = comment.trim();
      await updateLeaveRequest(id, { status, pmComment });
      setLeaves((prev) => prev.map((l) => l.id === id ? { ...l, status, pmComment } : l));
      setActionId(null);
      setComment('');
      toast({ title: status === 'APPROVED' ? 'Leave Approved' : 'Leave Rejected', description: 'The team member has been notified.' });

      // Notify the requester
      createNotification({
        userId: leaveItem.userId,
        type: 'LEAVE_STATUS_UPDATED',
        title: `Leave Request ${status.charAt(0) + status.slice(1).toLowerCase()}`,
        message: `Your leave request for ${leaveItem.startDate} to ${leaveItem.endDate} has been ${status.toLowerCase()}${pmComment ? ` with comment: "${pmComment}"` : ''}.`,
        link: '/member/leaves',
      }).catch(console.error);

    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update.', variant: 'destructive' });
    } finally {
      setUpdating(false);
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

  if (role !== 'PROJECT_MANAGER') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-2">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-xl font-bold">Access Denied</h2>
        </div>
      </AppLayout>
    );
  }

  const pending = leaves.filter(l => l.status === 'PENDING').length;
  const approved = leaves.filter(l => l.status === 'APPROVED').length;
  const rejected = leaves.filter(l => l.status === 'REJECTED').length;

  const filtered = filterStatus === 'ALL' ? leaves : leaves.filter(l => l.status === filterStatus);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Leave Requests</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-amber-500">{pending}</p>
            <p className="text-xs text-muted-foreground mt-1">Pending</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-emerald-500">{approved}</p>
            <p className="text-xs text-muted-foreground mt-1">Approved</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-rose-500">{rejected}</p>
            <p className="text-xs text-muted-foreground mt-1">Rejected</p>
          </CardContent></Card>
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
            <Button
              key={s}
              variant={filterStatus === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus(s)}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </Button>
          ))}
        </div>

        {/* Leave list */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">No leave requests found.</CardContent></Card>
          ) : (
            filtered.map((leave) => (
              <Card key={leave.id} className={`overflow-hidden transition-all ${leave.status === 'PENDING' ? 'border-amber-200' : ''}`}>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      {/* Employee info */}
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-bold text-sm">{leave.userName}</span>
                        <span className="text-xs text-muted-foreground">{leave.userEmail}</span>
                      </div>
                      {/* Date range */}
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{formatDate(leave.startDate)} → {formatDate(leave.endDate)}</span>
                        <span className="text-xs text-muted-foreground">({leave.days} day{leave.days !== 1 ? 's' : ''})</span>
                      </div>
                      {/* Reason */}
                      <p className="text-sm text-muted-foreground pl-6">{leave.reason}</p>
                      {/* Existing PM comment */}
                      {leave.pmComment && (
                        <p className="text-xs text-muted-foreground pl-6 italic">PM comment: {leave.pmComment}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0">{statusBadge(leave.status)}</div>
                  </div>

                  {/* Action panel toggle */}
                  {leave.status === 'PENDING' && (
                    <div className="border-t pt-3 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setActionId(leave.id); setComment(''); }}
                        className="gap-1.5 hover:bg-primary/5 hover:text-primary transition-colors border-primary/20 text-primary font-semibold"
                      >
                        <Clock className="h-4 w-4" /> Review Request
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* PM Review Modal Popup */}
        {actionId && (
          (() => {
            const leaveItem = leaves.find(l => l.id === actionId);
            if (!leaveItem) return null;
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                  onClick={() => { setActionId(null); setComment(''); }}
                />

                {/* Modal Card */}
                <Card className="relative w-full max-w-lg border border-primary/20 bg-background shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-10">
                  <CardHeader className="pb-4 bg-muted/40 border-b">
                    <CardTitle className="text-lg font-bold text-primary flex items-center gap-2">
                      <CalendarDays className="h-5.5 w-5.5 text-primary" /> Review Leave Request
                    </CardTitle>
                    <CardDescription>Review details and respond to the request.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    {/* User profile detail */}
                    <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-xl border border-muted-foreground/10">
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base uppercase">
                        {leaveItem.userName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-foreground">{leaveItem.userName}</p>
                        <p className="text-xs text-muted-foreground">{leaveItem.userEmail}</p>
                      </div>
                    </div>

                    {/* Date range details */}
                    <div className="grid grid-cols-2 gap-4 p-3 bg-card border rounded-xl shadow-sm text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <div>
                        <span className="block mb-0.5">Start Date</span>
                        <span className="text-sm font-bold text-foreground capitalize">{formatDate(leaveItem.startDate)}</span>
                      </div>
                      <div>
                        <span className="block mb-0.5">End Date</span>
                        <span className="text-sm font-bold text-foreground capitalize">{formatDate(leaveItem.endDate)}</span>
                      </div>
                      <div className="col-span-2 pt-2 border-t text-sm font-bold text-primary normal-case flex justify-between items-center">
                        <span>Total Requested Duration:</span>
                        <span className="text-base font-extrabold">{leaveItem.days} day(s)</span>
                      </div>
                    </div>

                    {/* Reason block */}
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Reason for Request</span>
                      <div className="p-3 bg-amber-50/30 text-amber-950/80 rounded-lg text-sm italic border border-amber-100/50 pl-4 border-l-4 border-l-amber-500">
                        "{leaveItem.reason}"
                      </div>
                    </div>

                    {/* Comment section */}
                    <div className="space-y-2">
                      <Label htmlFor="pm-comment" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Response Comment (Optional)</Label>
                      <Textarea
                        id="pm-comment"
                        placeholder="Add a message for the team member..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                        className="focus-visible:ring-2 focus-visible:ring-primary/40 text-sm p-3 rounded-lg bg-background"
                      />
                    </div>

                    {/* Approve / Reject buttons */}
                    <div className="flex gap-3 justify-end pt-3 border-t">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 px-5 font-semibold"
                        onClick={() => { setActionId(null); setComment(''); }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="h-11 px-5 font-semibold bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                        onClick={() => handleDecision(leaveItem.id, 'REJECTED')}
                        disabled={updating}
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                      <Button
                        type="button"
                        className="h-11 px-6 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        onClick={() => handleDecision(leaveItem.id, 'APPROVED')}
                        disabled={updating}
                      >
                        <CheckCircle className="h-4 w-4" /> Approve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()
        )}
      </div>
    </AppLayout>
  );
}
