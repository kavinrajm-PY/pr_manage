'use client';

// src/components/tasks/CreateTaskDialog.tsx
// Dialog popup for Team Leads to create and assign tasks.
// Uses native <select> elements to avoid Base UI's SelectPrimitive.Value
// rendering the raw value (UID) instead of the item's display text.

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createTask } from '@/services/tasks';
import { createNotification } from '@/services/notifications';
import { sendTaskAssignedNotification } from '@/services/email';
import { Task, TaskPriority, User, Project } from '@/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

// Shared style for native selects — matches the app's Input / Trigger look
const nativeSelectClass =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

interface CreateTaskDialogProps {
  project: Project;
  projectMembers: User[]; // Already filtered to Team Members of the project
  onTaskCreated: (newTask: Task) => void;
}

export function CreateTaskDialog({ project, projectMembers, onTaskCreated }: CreateTaskDialogProps) {
  const { firebaseUser, userProfile } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [deadline, setDeadline] = useState('');
  const [notifyViaEmail, setNotifyViaEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Only active members can be assigned tasks
  const activeMembers = projectMembers.filter((m) => m.isActive !== false);

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    if (!title || !assignedTo || !deadline) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    // Task deadline validation
    const taskDeadlineDate = new Date(deadline);
    const projectStartDate = new Date(project.startDate);
    const projectDeadlineDate = new Date(project.deadline);

    taskDeadlineDate.setHours(0, 0, 0, 0);
    projectStartDate.setHours(0, 0, 0, 0);
    projectDeadlineDate.setHours(0, 0, 0, 0);

    if (taskDeadlineDate < projectStartDate) {
      toast({
        title: 'Validation Error',
        description: `Task deadline cannot be before project start date (${project.startDate}).`,
        variant: 'destructive',
      });
      return;
    }

    if (taskDeadlineDate > projectDeadlineDate) {
      toast({
        title: 'Validation Error',
        description: `Task deadline cannot be after project deadline (${project.deadline}).`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const task = await createTask({
        projectId: project.id,
        title,
        description,
        assignedTo,
        createdBy: firebaseUser.uid,
        priority,
        deadline,
      });

      onTaskCreated(task);

      // Notify assignee
      createNotification({
        userId: assignedTo,
        type: 'TASK_ASSIGNED',
        title: 'New Task Assigned',
        message: `A new task "${title}" has been assigned to you by your Team Lead in "${project.name}".`,
        link: `/tasks/${task.id}`,
      }).catch((err) => console.error('Failed to create task notification', err));

      if (notifyViaEmail) {
        const selectedMember = projectMembers.find((m) => m.id === assignedTo);
        if (selectedMember) {
          sendTaskAssignedNotification({
            email: selectedMember.email,
            fullName: selectedMember.name,
            taskTitle: title,
            taskDescription: description,
            projectName: project.name,
            createdDate: new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            deadline: new Date(deadline).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }),
            createdByName: userProfile?.name || 'Your Team Lead',
          }).catch((err) => console.error('Failed to send task assignment email', err));
        }
      }

      // Reset form
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setPriority('MEDIUM');
      setDeadline('');
      setNotifyViaEmail(false);
      setOpen(false);

      toast({
        title: 'Task Created',
        description: `Task "${title}" has been created successfully.`,
      });
    } catch (error: any) {
      console.error('Failed to create task', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create task.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button className="gap-2" id="create-task-trigger-btn">
          <Plus className="h-4 w-4" /> Create Task
        </Button>
      } />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>
            Assign a new task to project team members.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateTask} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="taskTitle">Task Title *</Label>
            <Input
              id="taskTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement Login Flow"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="taskDesc">Description</Label>
            <Textarea
              id="taskDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the scope of work..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* ── Assignee — native <select> so option text (name) shows in trigger ── */}
            <div className="space-y-1">
              <Label htmlFor="assignee">Assign To *</Label>
              <select
                id="assignee"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                required
                className={nativeSelectClass}
              >
                <option value="">
                  {activeMembers.length === 0 ? 'No active members' : 'Select member'}
                </option>
                {activeMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              {activeMembers.length === 0 && (
                <p className="text-[11px] text-rose-500 font-medium mt-0.5">
                  All project members are inactive.
                </p>
              )}
            </div>

            {/* ── Priority — native <select> for same reason ── */}
            <div className="space-y-1">
              <Label htmlFor="priority">Priority *</Label>
              <select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className={nativeSelectClass}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="taskDeadline">Deadline *</Label>
            <Input
              id="taskDeadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center space-x-2 py-1.5">
            <input
              type="checkbox"
              id="notifyViaEmail"
              checked={notifyViaEmail}
              onChange={(e) => setNotifyViaEmail(e.target.checked)}
              className="h-4.5 w-4.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <Label htmlFor="notifyViaEmail" className="text-sm font-medium cursor-pointer">
              Notify via Email
            </Label>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || activeMembers.length === 0}>
              {submitting ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
