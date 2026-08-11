'use client';

// src/app/reports/page.tsx
// Project Manager only — generate individual performance PDF reports.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/AuthContext';
import { getUsersByRole } from '@/services/users';
import { getTasksByAssignee, getAllProgressHistory } from '@/services/tasks';
import { getApprovedLeavesInRange } from '@/services/leaveRequests';
import { User, Task, LeaveRequest } from '@/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { useToast } from '@/hooks/use-toast';
import { FileText, Download, ShieldAlert, BarChart2, User as UserIcon } from 'lucide-react';
import { formatDate } from '@/lib/utils/dates';

// ─── Date range helpers ──────────────────────────────────────────────────────

function getRange(period: string): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  if (period === 'this_week') {
    const day = now.getDay(); // 0=Sun
    const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: fmt(mon), to: fmt(sun) };
  }
  if (period === 'this_month') {
    return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) };
  }
  if (period === 'last_month') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: fmt(first), to: fmt(last) };
  }
  return { from: '', to: '' }; // custom
}

// ─── Reconstruct Progress at Timestamp ───────────────────────────────────────

function getTaskProgressAtTimestamp(
  task: Task,
  history: any[],
  timestampStr: string
): number {
  const targetTime = new Date(timestampStr + 'T23:59:59').getTime();
  const taskLogs = history
    .filter((h) => h.taskId === task.id)
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

  // Find latest log before or equal to targetTime
  const logsBefore = taskLogs.filter((h) => new Date(h.updatedAt).getTime() <= targetTime);
  if (logsBefore.length > 0) {
    return logsBefore[logsBefore.length - 1].newProgress;
  }

  // Find first log after targetTime
  const logsAfter = taskLogs.filter((h) => new Date(h.updatedAt).getTime() > targetTime);
  if (logsAfter.length > 0) {
    return logsAfter[0].previousProgress;
  }

  // Fallback: no logs exist.
  const taskCreatedTime = task.createdAt ? new Date(task.createdAt).getTime() : 0;
  if (taskCreatedTime > targetTime) {
    return 0; // task not created yet
  }
  
  // If created before targetTime and has no logs, its progress was its current progress
  return task.status === 'COMPLETED' ? 100 : (task.completionPercent ?? 0);
}

// ─── Calculate leave overlap days ────────────────────────────────────────────

function calculateOverlapDays(
  leave: LeaveRequest,
  periodStart: string,
  periodEnd: string
): number {
  const leaveStart = new Date(leave.startDate).getTime();
  const leaveEnd = new Date(leave.endDate).getTime();
  const rangeStart = new Date(periodStart).getTime();
  const rangeEnd = new Date(periodEnd).getTime();

  const overlapStart = Math.max(leaveStart, rangeStart);
  const overlapEnd = Math.min(leaveEnd, rangeEnd);

  if (overlapStart <= overlapEnd) {
    return Math.round((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
  }
  return 0;
}

// ─── Report data type ────────────────────────────────────────────────────────

interface ReportData {
  user: User;
  from: string; // PeriodStart
  to: string;   // PeriodEnd
  total: number; // Relevant tasks during period (divisor)
  completed: number; // Completed during period
  inProgress: number;
  todo: number;
  blocked: number;
  
  // Overdue breakdown metrics
  overdueDuring: number; // Existed during period
  overdueAtStart: number;
  newlyOverdue: number;
  overdueResolved: number;
  overdueAtEnd: number;

  workProgress: number; // SUM of positive Progress Changes during period
  workProgressScore: number; // MIN(100, workProgress)
  workedOnCount: number; // Number of tasks worked on in period
  completionRate: number; // Completed during period / Relevant tasks * 100
  sumCompletionPct: number;
  nonCompletedTasks: number;
  overallTaskProgress: number;

  leaveDays: number; // approved leave days overlapping the period
  leaves: LeaveRequest[];
  tasks: Task[];
  taskProgressDetails: {
    title: string;
    progressAtStart: number;
    progressAtEnd: number;
    progressDuring: number;
    deadline: string;
    status: string;
    statusChanged: boolean;
  }[];
}

// ─── Performance score (0-100) ───────────────────────────────────────────────

function performanceScore(data: ReportData): number {
  if (data.total === 0) return 0;
  
  // Progress Component: Work Progress Score * 0.70
  const progressComponent = data.workProgressScore * 0.70;
  // Completion Component: Completion Rate * 0.30
  const completionComponent = data.completionRate * 0.30;
  
  // Overdue Deduction: MIN(10, Overdue Tasks * 10)
  const overdueDeduction = Math.min(10, data.overdueDuring * 10);
  // Leave Deduction: MIN(5, Approved Leave Days * 5)
  const leaveDeduction = Math.min(5, data.leaveDays * 5);

  const finalScore = progressComponent + completionComponent - overdueDeduction - leaveDeduction;
  return Math.max(0, Math.min(100, Math.round(finalScore)));
}

// ─── Management Summary Text Generator ──────────────────────────────────────

function generateSummaryText(data: ReportData): string {
  const workedCount = data.workedOnCount;
  const totalCount = data.total;
  const completedCount = data.completed;
  const overdueCount = data.overdueDuring;
  const leaveCount = data.leaveDays;
  
  const workedTasksList = data.taskProgressDetails.filter(t => t.progressDuring > 0 || t.statusChanged);
  
  let progressDescription = '';
  if (workedTasksList.length === 1) {
    const task = workedTasksList[0];
    progressDescription = `increased the progress of that task from ${task.progressAtStart}% to ${task.progressAtEnd}%`;
  } else if (workedTasksList.length > 1) {
    progressDescription = `increased the overall progress of those tasks by a total of ${data.workProgress}%`;
  } else {
    progressDescription = `made no progress changes on tasks`;
  }

  const completedText = completedCount === 0
    ? 'No tasks were completed'
    : completedCount === 1
      ? '1 task was completed'
      : `${completedCount} tasks were completed`;
    
  const overdueText = overdueCount === 0
    ? 'no tasks were overdue'
    : overdueCount === 1
      ? '1 task was overdue'
      : `${overdueCount} tasks were overdue`;
    
  const leaveText = leaveCount === 0 
    ? 'no approved leave was recorded'
    : `${leaveCount} day(s) of approved leave were recorded`;

  return `The employee worked on ${workedCount} of ${totalCount} assigned tasks during this period and ${progressDescription}. ${completedText}, ${overdueText}, and ${leaveText}.`;
}

// ─── PDF generation ──────────────────────────────────────────────────────────

async function generatePDF(data: ReportData, periodLabel: string) {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const score = performanceScore(data);
  const summaryText = generateSummaryText(data);

  // ── Header banner
  doc.setFillColor(88, 50, 106);
  doc.rect(0, 0, pageW, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('PY Manage', 14, 15);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Individual Performance Report', 14, 23);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 31);

  // ── Employee card
  doc.setTextColor(30, 30, 30);
  doc.setFillColor(248, 245, 252);
  doc.rect(10, 44, pageW - 20, 28, 'F');
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(data.user.name, 16, 54);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Email: ${data.user.email}`, 16, 61);
  doc.text(`Role: Team Member`, 16, 67);
  doc.text(`Period: ${periodLabel}  (${formatDate(data.from)} - ${formatDate(data.to)})`, 90, 61);

  // ── Performance score badge
  const scoreColor: [number, number, number] = score >= 80 ? [34, 197, 94] : score >= 60 ? [234, 179, 8] : [239, 68, 68];
  doc.setFillColor(...scoreColor);
  doc.roundedRect(pageW - 50, 44, 40, 28, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(`${score}`, pageW - 38, 58, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Performance Score', pageW - 38, 67, { align: 'center' });

  // ── Dashboard Metrics Table
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Performance Metrics Summary', 14, 82);

  autoTable(doc, {
    startY: 86,
    head: [['Metric', 'Value', 'Notes']],
    body: [
      ['Performance Score', `${score} / 100`, `Weight: 70% Progress, 30% Completion`],
      ['Work Progress', `${data.workProgressScore}%`, `Sum of progress changes during period (capped at 100%)`],
      ['Tasks Worked On', `${data.workedOnCount} / ${data.total}`, `${data.workedOnCount} task(s) had progress increases or status updates`],
      ['Tasks Completed', `${data.completed} / ${data.total}`, `Completed strictly within reporting period`],
      ['Completion Rate', `${data.completionRate}%`, `Tasks Completed / Tasks Relevant * 100`],
      ['Overdue Tasks', String(data.overdueDuring), `Overdue deduction: -${Math.min(10, data.overdueDuring * 10)} pts`],
      ['Approved Leave Days', `${data.leaveDays} days`, `Leave deduction: -${Math.min(5, data.leaveDays * 5)} pts`],
    ],
    headStyles: { fillColor: [88, 50, 106], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 245, 252] },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 70 }, 1: { halign: 'center', cellWidth: 30 }, 2: { halign: 'left' } },
  });

  // ── Management Summary Text
  const summaryY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Management Summary', 14, summaryY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const splitSummary = doc.splitTextToSize(summaryText, pageW - 28);
  doc.text(splitSummary, 14, summaryY + 5);

  // ── Task detail table
  const taskY = summaryY + 8 + (splitSummary.length * 4.5);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Task Progress Timeline', 14, taskY);

  autoTable(doc, {
    startY: taskY + 4,
    head: [['Task Title', 'Status', 'Start %', 'End %', 'Change %', 'Deadline']],
    body: data.taskProgressDetails.map(t => [
      t.title.length > 40 ? t.title.slice(0, 40) + '...' : t.title,
      t.status,
      `${t.progressAtStart}%`,
      `${t.progressAtEnd}%`,
      `+${t.progressDuring}%`,
      formatDate(t.deadline),
    ]),
    headStyles: { fillColor: [88, 50, 106], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 245, 252] },
    styles: { fontSize: 8, cellPadding: 2.5 },
  });

  // ── Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`PY Manage — Confidential | Page ${i} of ${totalPages}`, pageW / 2, 290, { align: 'center' });
  }

  doc.save(`PY_Manage_Report_${data.user.name.replace(/\s+/g, '_')}_${data.from}_${data.to}.pdf`);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { role } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [period, setPeriod] = useState('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<ReportData | null>(null);

  useEffect(() => {
    if (!loading && role !== 'PROJECT_MANAGER') router.push('/login');
  }, [role, loading, router]);

  useEffect(() => {
    if (role !== 'PROJECT_MANAGER') return;
    const roles = ['TEAM_MEMBER', 'TEAM_LEAD'] as const;
    Promise.all(roles.map((r) => getUsersByRole(r)))
      .then(([m, l]) => setMembers([...m, ...l]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [role]);

  async function handleGenerate() {
    if (!selectedUserId) {
      toast({ title: 'Select a user', description: 'Please choose a team member.', variant: 'destructive' });
      return;
    }
    const range = period === 'custom' ? { from: customFrom, to: customTo } : getRange(period);
    if (!range.from || !range.to) {
      toast({ title: 'Date range required', description: 'Please select a date range.', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const user = members.find(m => m.id === selectedUserId)!;
      
      // Fetch tasks, approved leaves, and progress history logs
      const [allTasks, allLeaves, progressHistory] = await Promise.all([
        getTasksByAssignee(selectedUserId),
        getApprovedLeavesInRange(selectedUserId, range.from, range.to),
        getAllProgressHistory(),
      ]);

      const rangeStartStr = range.from;
      const rangeEndStr = range.to;
      const startMs = new Date(rangeStartStr).getTime();
      const endMs = new Date(rangeEndStr + 'T23:59:59').getTime();

      // 1. Filter tasks relevant during the period
      const relevantTasks = allTasks.filter(t => {
        const createdMs = t.createdAt ? new Date(t.createdAt).getTime() : 0;
        const completedMs = t.completedAt ? new Date(t.completedAt).getTime() : null;
        return createdMs <= endMs && (completedMs === null || completedMs >= startMs);
      });

      // 2. Completed during period
      const completedTasks = relevantTasks.filter(t => {
        if (!t.completedAt) return false;
        const compTime = new Date(t.completedAt).getTime();
        return compTime >= startMs && compTime <= endMs;
      });

      const completed = completedTasks.length;
      const inProgress = relevantTasks.filter(t => t.status === 'IN_PROGRESS' && (!t.completedAt || new Date(t.completedAt).getTime() > endMs)).length;
      const todo = relevantTasks.filter(t => t.status === 'TODO' && (!t.completedAt || new Date(t.completedAt).getTime() > endMs)).length;
      const blocked = relevantTasks.filter(t => t.status === 'BLOCKED' && (!t.completedAt || new Date(t.completedAt).getTime() > endMs)).length;

      // 3. Overdue Tasks
      const overdueTasks = relevantTasks.filter(t => {
        const dlMs = new Date(t.deadline).getTime();
        const compMs = t.completedAt ? new Date(t.completedAt).getTime() : null;
        const isOverdueAtSomePoint = dlMs <= endMs && (compMs === null || compMs > dlMs);
        const existedInPeriod = compMs === null || compMs >= startMs;
        return isOverdueAtSomePoint && existedInPeriod;
      });
      const overdueDuring = overdueTasks.length;

      const overdueAtStart = relevantTasks.filter(t => {
        const dlMs = new Date(t.deadline).getTime();
        const compMs = t.completedAt ? new Date(t.completedAt).getTime() : null;
        return dlMs < startMs && (compMs === null || compMs >= startMs);
      }).length;

      const newlyOverdue = relevantTasks.filter(t => {
        const dlMs = new Date(t.deadline).getTime();
        const compMs = t.completedAt ? new Date(t.completedAt).getTime() : null;
        return dlMs >= startMs && dlMs <= endMs && (compMs === null || compMs > dlMs);
      }).length;

      const overdueResolved = relevantTasks.filter(t => {
        if (!t.completedAt) return false;
        const compMs = new Date(t.completedAt).getTime();
        const dlMs = new Date(t.deadline).getTime();
        return compMs >= startMs && compMs <= endMs && compMs > dlMs;
      }).length;

      const overdueAtEnd = relevantTasks.filter(t => {
        const dlMs = new Date(t.deadline).getTime();
        const compMs = t.completedAt ? new Date(t.completedAt).getTime() : null;
        return dlMs <= endMs && (compMs === null || compMs > endMs);
      }).length;

      // 4. Progress details, changes, and Worked On count
      let sumProgressInPeriod = 0;
      let workedOnCount = 0;

      const taskProgressDetails = relevantTasks.map(t => {
        const startVal = getTaskProgressAtTimestamp(t, progressHistory, rangeStartStr);
        const endVal = getTaskProgressAtTimestamp(t, progressHistory, rangeEndStr);
        
        // Progress difference
        const diff = Math.max(0, endVal - startVal);
        sumProgressInPeriod += diff;

        // Check if task status changed during period
        const taskLogs = progressHistory.filter((h) => h.taskId === t.id);
        const logsInPeriod = taskLogs.filter((h) => {
          const logTime = new Date(h.updatedAt).getTime();
          return logTime >= startMs && logTime <= endMs;
        });
        const statusChanged = logsInPeriod.some((h) => h.previousStatus !== h.newStatus);

        // A task is worked on if it progressed OR status changed
        const workedOn = diff > 0 || statusChanged;
        if (workedOn) {
          workedOnCount++;
        }

        return {
          title: t.title,
          progressAtStart: startVal,
          progressAtEnd: endVal,
          progressDuring: diff,
          deadline: t.deadline,
          status: t.status,
          statusChanged,
        };
      });

      const total = relevantTasks.length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      // Work Progress Score = MIN(100, Sum of positive progress changes)
      const workProgress = sumProgressInPeriod;
      const workProgressScore = Math.min(100, workProgress);

      const nonCompletedTasks = total - completed;
      const overallTaskProgress = nonCompletedTasks > 0
        ? Math.round(sumProgressInPeriod / nonCompletedTasks)
        : (completed > 0 ? 100 : 0);

      // 5. Approved Overlapping Leave Days
      const overlappingLeaves = allLeaves.filter(l => calculateOverlapDays(l, rangeStartStr, rangeEndStr) > 0);
      const leaveDays = overlappingLeaves.reduce((sum, l) => sum + calculateOverlapDays(l, rangeStartStr, rangeEndStr), 0);

      setPreview({
        user,
        from: rangeStartStr,
        to: rangeEndStr,
        total,
        completed,
        inProgress,
        todo,
        blocked,
        overdueDuring,
        overdueAtStart,
        newlyOverdue,
        overdueResolved,
        overdueAtEnd,
        completionRate,
        workProgress,
        workProgressScore,
        workedOnCount,
        sumCompletionPct: sumProgressInPeriod,
        nonCompletedTasks,
        overallTaskProgress,
        leaveDays,
        leaves: overlappingLeaves,
        tasks: relevantTasks,
        taskProgressDetails,
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to generate report.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  }

  const periodLabels: Record<string, string> = {
    this_week: 'This Week', this_month: 'This Month', last_month: 'Last Month', custom: 'Custom Range',
  };

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

  const score = preview ? performanceScore(preview) : null;
  const summaryText = preview ? generateSummaryText(preview) : '';

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          <BarChart2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Performance Reports</h1>
        </div>

        {/* Report Builder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generate Individual Report</CardTitle>
            <CardDescription>Select a team member and time period to generate a PDF performance report.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Member selector */}
              <div className="space-y-1">
                <Label htmlFor="member-select">Team Member *</Label>
                <select
                  id="member-select"
                  value={selectedUserId}
                  onChange={(e) => { setSelectedUserId(e.target.value); setPreview(null); }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                >
                  <option value="">Select member…</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.role.replace('_', ' ')})</option>
                  ))}
                </select>
              </div>

              {/* Period selector */}
              <div className="space-y-1">
                <Label htmlFor="period-select">Period *</Label>
                <select
                  id="period-select"
                  value={period}
                  onChange={(e) => { setPeriod(e.target.value); setPreview(null); }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-ring cursor-pointer"
                >
                  <option value="this_week">This Week</option>
                  <option value="this_month">This Month</option>
                  <option value="last_month">Last Month</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
            </div>

            {period === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="custom-from">From</Label>
                  <Input id="custom-from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="custom-to">To</Label>
                  <Input id="custom-to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-10" />
                </div>
              </div>
            )}

            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? (
                <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating…</>
              ) : (
                <><FileText className="h-4 w-4" /> Generate Report Preview</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Preview */}
        {preview && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserIcon className="h-4 w-4 text-primary" /> {preview.user.name}
                  </CardTitle>
                  <CardDescription>{periodLabels[period]} — {formatDate(preview.from)} to {formatDate(preview.to)}</CardDescription>
                </div>
                <Button
                  onClick={() => generatePDF(preview, periodLabels[period])}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Metric Dashboard Blocks at Top */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="bg-primary/5 border-primary/20"><CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Performance Score</p>
                  <p className="text-3xl font-extrabold text-primary mt-1">{score} / 100</p>
                </CardContent></Card>
                
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Work Progress</p>
                  <p className="text-3xl font-extrabold text-foreground mt-1">{preview.workProgressScore}%</p>
                </CardContent></Card>
                
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Tasks Worked On</p>
                  <p className="text-3xl font-extrabold text-foreground mt-1">{preview.workedOnCount} / {preview.total}</p>
                </CardContent></Card>
                
                <Card><CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Tasks Completed</p>
                  <p className="text-3xl font-extrabold text-foreground mt-1">{preview.completed} / {preview.total}</p>
                </CardContent></Card>

                <Card><CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Completion Rate</p>
                  <p className="text-3xl font-extrabold text-foreground mt-1">{preview.completionRate}%</p>
                </CardContent></Card>

                <Card className={preview.overdueDuring > 0 ? 'bg-amber-50/50 border-amber-200' : ''}><CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Overdue</p>
                  <p className={`text-3xl font-extrabold mt-1 ${preview.overdueDuring > 0 ? 'text-amber-600' : 'text-foreground'}`}>{preview.overdueDuring}</p>
                </CardContent></Card>

                <Card className={preview.leaveDays > 0 ? 'bg-rose-50/50 border-rose-200' : ''}><CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Approved Leave</p>
                  <p className={`text-3xl font-extrabold mt-1 ${preview.leaveDays > 0 ? 'text-rose-600' : 'text-foreground'}`}>{preview.leaveDays} Days</p>
                </CardContent></Card>
              </div>

              {/* Management Factual Summary Box */}
              <div className="p-4 bg-muted/40 rounded-xl border border-muted-foreground/15 space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Management Summary</Label>
                <p className="text-sm font-medium text-foreground italic leading-relaxed">
                  "{summaryText}"
                </p>
              </div>

              {/* Overdue sub-metrics grid */}
              <div className="space-y-2">
                <Label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Overdue Tasks Timeline</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Overdue at Start', value: preview.overdueAtStart },
                    { label: 'Newly Overdue', value: preview.newlyOverdue },
                    { label: 'Overdue Resolved', value: preview.overdueResolved },
                    { label: 'Overdue at End', value: preview.overdueAtEnd },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted/10 border rounded p-2 text-center">
                      <p className="text-lg font-bold text-foreground">{value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Task breakdown list */}
              <div className="space-y-3">
                <Label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Task-Level Breakdown</Label>
                <div className="space-y-2">
                  {preview.taskProgressDetails.map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border bg-card hover:bg-muted/10 gap-3">
                      <div className="space-y-0.5">
                        <p className="font-semibold text-sm">{item.title}</p>
                        <p className="text-xs text-muted-foreground">Deadline: {formatDate(item.deadline)} | Status: <span className="font-medium text-foreground capitalize">{item.status.toLowerCase().replace('_', ' ')}</span></p>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div className="text-xs text-muted-foreground">
                          Progress: <span className="font-medium text-foreground">{item.progressAtStart}%</span> → <span className="font-medium text-foreground">{item.progressAtEnd}%</span>
                        </div>
                        <div className={`px-2.5 py-1 rounded text-xs font-bold ${item.progressDuring > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-muted/40 text-muted-foreground border border-muted'}`}>
                          +{item.progressDuring}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
