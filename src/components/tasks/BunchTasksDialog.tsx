'use client';

// src/components/tasks/BunchTasksDialog.tsx
// Dialog popup for Team Leads to batch import tasks from a JSON payload.

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PriorityBadge } from '@/components/ui/priority-badge';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createTask } from '@/services/tasks';
import { createNotification } from '@/services/notifications';
import { sendTaskAssignedNotification } from '@/services/email';
import { Task, TaskPriority, User, Project } from '@/types';
import { FileJson, AlertCircle, CheckCircle2, Copy, Check, Calendar, ArrowLeft, Loader2, Sparkles, Info } from 'lucide-react';
import { formatDate } from '@/lib/utils/dates';

interface BunchTasksDialogProps {
  project: Project;
  projectMembers: User[]; // Filtered project members
  onTasksCreated: (newTasks: Task[]) => void;
}

interface ParsedTask {
  title: string;
  description: string;
  assignedToInput: string;
  resolvedUser: User;
  priority: TaskPriority;
  deadline: string;
  notify: boolean;
}

interface ValidationError {
  taskIndex: number;
  taskTitle: string;
  field: string;
  message: string;
}

const JSON_TEMPLATE = `[
  {
    "title": "Design Landing Page",
    "description": "Create high-fidelity designs for the main home page",
    "assignedTo": "Alice Smith",
    "priority": "HIGH",
    "deadline": "2026-08-25",
    "notify": "yes"
  },
  {
    "title": "Configure Database Schema",
    "description": "Create Firestore collections and write security rules",
    "assignedTo": "dev@company.com",
    "priority": "MEDIUM",
    "deadline": "2026-08-28",
    "notify": "no"
  }
]`;

export function BunchTasksDialog({ project, projectMembers, onTasksCreated }: BunchTasksDialogProps) {
  const { firebaseUser, userProfile } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [view, setView] = useState<'input' | 'preview' | 'errors'>('input');
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Active members only
  const activeMembers = projectMembers.filter((m) => m.isActive !== false);

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(JSON_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Template Copied',
      description: 'JSON template copied to clipboard.',
    });
  };

  const handleValidateAndPreview = () => {
    if (!jsonText.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please paste or write your JSON before validating.',
        variant: 'destructive',
      });
      return;
    }

    const validationErrors: ValidationError[] = [];
    const validTasks: ParsedTask[] = [];

    let parsedData: any;
    try {
      parsedData = JSON.parse(jsonText);
    } catch (err: any) {
      setErrors([
        {
          taskIndex: -1,
          taskTitle: 'JSON Syntax',
          field: 'Format',
          message: `Invalid JSON format: ${err.message}`,
        },
      ]);
      setView('errors');
      return;
    }

    const rawTasks = Array.isArray(parsedData) ? parsedData : [parsedData];

    if (rawTasks.length === 0) {
      setErrors([
        {
          taskIndex: -1,
          taskTitle: 'Empty Payload',
          field: 'JSON Array',
          message: 'The JSON array must contain at least one task object.',
        },
      ]);
      setView('errors');
      return;
    }

    rawTasks.forEach((item, index) => {
      const taskTitle = item.title || `Task #${index + 1}`;

      // 1. Title Validation
      if (!item.title || typeof item.title !== 'string' || !item.title.trim()) {
        validationErrors.push({
          taskIndex: index,
          taskTitle,
          field: 'title',
          message: 'Task title is required and must be a non-empty string.',
        });
      }

      // 2. Assignee Validation & Matching
      // Support common keys: assignedTo, assignee, assigned_to, member, user, name, email
      const rawAssignee =
        item.assignedTo ||
        item.assignee ||
        item.assigned_to ||
        item.member ||
        item.user ||
        item.email ||
        item.name;

      let matchedUser: User | null = null;

      if (!rawAssignee || typeof rawAssignee !== 'string' || !rawAssignee.trim()) {
        validationErrors.push({
          taskIndex: index,
          taskTitle,
          field: 'assignedTo',
          message: 'Task assignee (email, name, or member ID) is required.',
        });
      } else {
        const searchStr = rawAssignee.trim().toLowerCase();
        // Match against project members
        matchedUser = activeMembers.find(
          (m) =>
            m.id.toLowerCase() === searchStr ||
            m.email.toLowerCase() === searchStr ||
            m.name.toLowerCase() === searchStr
        ) || null;

        if (!matchedUser) {
          validationErrors.push({
            taskIndex: index,
            taskTitle,
            field: 'assignedTo',
            message: `No active project member matches '${rawAssignee}'. Make sure the person is assigned to the project.`,
          });
        }
      }

      // 3. Deadline Validation
      let deadlineStr = '';
      if (!item.deadline || typeof item.deadline !== 'string') {
        validationErrors.push({
          taskIndex: index,
          taskTitle,
          field: 'deadline',
          message: 'Task deadline is required and must be in YYYY-MM-DD format.',
        });
      } else {
        deadlineStr = item.deadline.trim();
        const taskDeadlineDate = new Date(deadlineStr);
        const projectStartDate = new Date(project.startDate);
        const projectDeadlineDate = new Date(project.deadline);

        taskDeadlineDate.setHours(0, 0, 0, 0);
        projectStartDate.setHours(0, 0, 0, 0);
        projectDeadlineDate.setHours(0, 0, 0, 0);

        if (isNaN(taskDeadlineDate.getTime())) {
          validationErrors.push({
            taskIndex: index,
            taskTitle,
            field: 'deadline',
            message: `Deadline '${deadlineStr}' is not a valid date. Use YYYY-MM-DD.`,
          });
        } else {
          if (taskDeadlineDate < projectStartDate) {
            validationErrors.push({
              taskIndex: index,
              taskTitle,
              field: 'deadline',
              message: `Task deadline cannot be before project start date (${project.startDate}).`,
            });
          }
          if (taskDeadlineDate > projectDeadlineDate) {
            validationErrors.push({
              taskIndex: index,
              taskTitle,
              field: 'deadline',
              message: `Task deadline cannot be after project deadline (${project.deadline}).`,
            });
          }
        }
      }

      // 4. Priority Normalization
      let priority: TaskPriority = 'MEDIUM';
      if (item.priority && typeof item.priority === 'string') {
        const prioUpper = item.priority.trim().toUpperCase();
        if (['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(prioUpper)) {
          priority = prioUpper as TaskPriority;
        }
      }

      // 5. Notify Normalization
      let notify = false;
      if (item.notify !== undefined) {
        if (typeof item.notify === 'boolean') {
          notify = item.notify;
        } else if (typeof item.notify === 'string') {
          const notifyStr = item.notify.trim().toLowerCase();
          notify = notifyStr === 'yes' || notifyStr === 'true';
        }
      }

      // Collect task if no errors for this record
      if (
        matchedUser &&
        validationErrors.filter((e) => e.taskIndex === index).length === 0
      ) {
        validTasks.push({
          title: item.title.trim(),
          description: (item.description || '').trim(),
          assignedToInput: String(rawAssignee),
          resolvedUser: matchedUser,
          priority,
          deadline: deadlineStr,
          notify,
        });
      }
    });

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setView('errors');
    } else {
      setParsedTasks(validTasks);
      setView('preview');
    }
  };

  const handleImportTasks = async () => {
    if (!firebaseUser) return;
    setImporting(true);

    try {
      const createdList: Task[] = [];
      for (const t of parsedTasks) {
        const task = await createTask({
          projectId: project.id,
          title: t.title,
          description: t.description,
          assignedTo: t.resolvedUser.id,
          createdBy: firebaseUser.uid,
          priority: t.priority,
          deadline: t.deadline,
        });

        createdList.push(task);

        // Notify assignee
        createNotification({
          userId: t.resolvedUser.id,
          type: 'TASK_ASSIGNED',
          title: 'New Task Assigned',
          message: `A new task "${t.title}" has been assigned to you by your Team Lead in "${project.name}".`,
          link: `/tasks/${task.id}`,
        }).catch((err) => console.error('Failed to create task notification', err));

        // If notify is set, send SMTP email
        if (t.notify) {
          sendTaskAssignedNotification({
            email: t.resolvedUser.email,
            fullName: t.resolvedUser.name,
            taskTitle: t.title,
            taskDescription: t.description,
            projectName: project.name,
            createdDate: new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            deadline: new Date(t.deadline).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            createdByName: userProfile?.name || 'Your Team Lead',
          }).catch((err) => console.error('Failed to send task assignment email', err));
        }
      }

      onTasksCreated(createdList);

      toast({
        title: 'Import Successful',
        description: `Imported and assigned ${createdList.length} tasks successfully.`,
      });

      // Reset & close
      setJsonText('');
      setParsedTasks([]);
      setErrors([]);
      setView('input');
      setOpen(false);
    } catch (error: any) {
      console.error('Batch import error', error);
      toast({
        title: 'Import Failed',
        description: error.message || 'An error occurred during batch task creation.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  const resetDialogState = () => {
    setJsonText('');
    setParsedTasks([]);
    setErrors([]);
    setView('input');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetDialogState();
      }}
    >
      <DialogTrigger render={
        <Button
          variant="outline"
          className="gap-2 border-primary/40 hover:bg-primary/5 hover:text-primary transition-all duration-300"
          id="bunch-tasks-trigger-btn"
        >
          <FileJson className="h-4 w-4" /> Bunch Tasks
        </Button>
      } />
      <DialogContent className="sm:max-w-[700px] w-[95vw] max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="shrink-0 pb-2 border-b">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <DialogTitle className="text-xl font-bold">Import Tasks (Bunch Tasks)</DialogTitle>
          </div>
          <DialogDescription>
            Paste task specifications in JSON format to create and assign them in bulk.
          </DialogDescription>
        </DialogHeader>

        {/* ── View 1: JSON Input ── */}
        {view === 'input' && (
          <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
            <div className="space-y-1.5 flex flex-col">
              <div className="flex justify-between items-center">
                <Label htmlFor="jsonInputText" className="text-sm font-semibold">
                  JSON Specification (Array of Tasks)
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyTemplate}
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy Example JSON
                </Button>
              </div>
              <Textarea
                id="jsonInputText"
                placeholder={`[\n  {\n    "title": "Task Title",\n    "description": "Task Description",\n    "assignedTo": "User Name or Email",\n    "priority": "HIGH",\n    "deadline": "YYYY-MM-DD"\n  }\n]`}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="font-mono text-xs min-h-[220px] bg-muted/20 focus:ring-1 focus:ring-primary border-muted-foreground/30 focus-visible:ring-offset-0 focus-visible:ring-primary"
              />
            </div>

            {/* Instruction Box */}
            <div className="rounded-lg border bg-muted/40 p-4 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Info className="h-4 w-4 text-primary" /> Supported Fields & Guidelines:
              </div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li><strong className="text-foreground">title</strong> (Required string): Name of the task.</li>
                <li><strong className="text-foreground">assignedTo</strong> (Required string): Matches active project members by Name, Email, or Member ID.</li>
                <li><strong className="text-foreground">deadline</strong> (Required YYYY-MM-DD): Must be between <code className="bg-muted px-1 rounded">{project.startDate}</code> and <code className="bg-muted px-1 rounded">{project.deadline}</code>.</li>
                <li><strong className="text-foreground">priority</strong> (Optional string): <code className="bg-muted px-1 rounded">LOW</code>, <code className="bg-muted px-1 rounded">MEDIUM</code>, <code className="bg-muted px-1 rounded">HIGH</code>, or <code className="bg-muted px-1 rounded">URGENT</code> (default is MEDIUM).</li>
                <li><strong className="text-foreground">description</strong> (Optional string): Detailed scope of work.</li>
                <li><strong className="text-foreground">notify</strong> (Optional string/boolean): <code className="bg-muted px-1 rounded">"yes"</code> or <code className="bg-muted px-1 rounded">"no"</code> (sends email notification if set to <code className="bg-muted px-1 rounded">"yes"</code> or <code className="bg-muted px-1 rounded">true</code>).</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── View 2: Errors Screen ── */}
        {view === 'errors' && (
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="flex items-center gap-3 p-4 border border-rose-200 bg-rose-50/30 rounded-lg shrink-0">
              <AlertCircle className="h-6 w-6 text-rose-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-rose-800">Validation Failed</h4>
                <p className="text-xs text-rose-700">Please fix the following validation issues to proceed.</p>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden divide-y">
              {errors.map((error, idx) => (
                <div key={idx} className="p-3 hover:bg-muted/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-foreground block sm:inline">
                      {error.taskIndex >= 0 ? `Task #${error.taskIndex + 1}:` : ''} {error.taskTitle}
                    </span>
                    <span className="text-rose-600 ml-0.5 sm:ml-2 font-medium bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 uppercase text-[10px]">
                      {error.field}
                    </span>
                    <p className="text-muted-foreground mt-1">{error.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── View 3: Preview Screen ── */}
        {view === 'preview' && (
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="flex items-center gap-3 p-4 border border-emerald-200 bg-emerald-50/30 rounded-lg shrink-0">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-emerald-800">JSON Validated Successfully</h4>
                <p className="text-xs text-emerald-700">Review the tasks below before creating them in the project.</p>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                Tasks Draft ({parsedTasks.length})
              </Label>
              <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
                {parsedTasks.map((t, idx) => (
                  <div key={idx} className="p-3 hover:bg-muted/10 transition-colors flex flex-col md:flex-row justify-between gap-3 text-xs">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">{t.title}</span>
                        <PriorityBadge priority={t.priority} />
                        {t.notify && (
                          <span className="bg-sky-50 text-sky-700 border border-sky-100 px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                            Notify
                          </span>
                        )}
                      </div>
                      {t.description && (
                        <p className="text-muted-foreground line-clamp-2">{t.description}</p>
                      )}
                    </div>
                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 border-t md:border-t-0 pt-2 md:pt-0 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-[10px] uppercase">
                          {t.resolvedUser.name.charAt(0)}
                        </div>
                        <span className="font-semibold text-foreground text-right">{t.resolvedUser.name}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Deadline: {formatDate(t.deadline)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 pt-4 border-t">
          {view === 'input' && (
            <>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleValidateAndPreview}>
                Validate & Preview
              </Button>
            </>
          )}

          {view === 'errors' && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setView('input')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Edit JSON
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </>
          )}

          {view === 'preview' && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={importing}
                onClick={() => setView('input')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Edit
              </Button>
              <Button
                type="button"
                disabled={importing}
                onClick={handleImportTasks}
                className="gap-1.5"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating Tasks...
                  </>
                ) : (
                  'Confirm & Import'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
