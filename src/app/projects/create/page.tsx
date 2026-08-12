'use client';

// src/app/projects/create/page.tsx
// PM only Project creation flow

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/AuthContext';
import { getUsersByRole } from '@/services/users';
import { createProject } from '@/services/projects';
import { addProjectMember } from '@/services/projectMembers';
import { createNotification } from '@/services/notifications';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FolderKanban, ShieldAlert } from 'lucide-react';

export default function CreateProjectPage() {
  const { role, firebaseUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [teamLeads, setTeamLeads] = useState<User[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);

  // Form inputs
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isDatePastOrToday = (dateStr: string) => {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    return date <= today;
  };

  useEffect(() => {
    if (!loading && role !== 'PROJECT_MANAGER') {
      router.push('/login');
    }
  }, [role, loading, router]);

  useEffect(() => {
    async function loadUsers() {
      try {
        const [leads, members] = await Promise.all([
          getUsersByRole('TEAM_LEAD'),
          getUsersByRole('TEAM_MEMBER'),
        ]);
        // Only active users can be added to a new project
        setTeamLeads(leads.filter((u) => u.isActive !== false));
        setTeamMembers(members.filter((u) => u.isActive !== false));
      } catch (error) {
        console.error('Failed to load users', error);
      } finally {
        setLoading(false);
      }
    }
    if (role === 'PROJECT_MANAGER') {
      loadUsers();
    }
  }, [role]);

  const handleMemberToggle = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    if (!name || !startDate || !deadline || !selectedLeadId) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    // Date validation: deadline must be after startDate
    const start = new Date(startDate);
    const end = new Date(deadline);
    if (end <= start) {
      toast({
        title: 'Validation Error',
        description: 'Project deadline must be strictly after the start date.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create project document
      const project = await createProject({
        name,
        description,
        startDate,
        deadline,
        createdBy: firebaseUser.uid,
      });

      // 2. Add Project Manager as a projectMember
      await addProjectMember({
        projectId: project.id,
        userId: firebaseUser.uid,
        role: 'PROJECT_MANAGER',
      });

      // 3. Add Team Lead as a projectMember
      await addProjectMember({
        projectId: project.id,
        userId: selectedLeadId,
        role: 'TEAM_LEAD',
      });

      // 4. Add Team Members as projectMembers
      await Promise.all(
        selectedMemberIds.map((memberId) =>
          addProjectMember({
            projectId: project.id,
            userId: memberId,
            role: 'TEAM_MEMBER',
          })
        )
      );

      // 5. Send Notifications to Lead and Members
      const notifyPromises: Promise<any>[] = [];

      // Notify Team Lead
      notifyPromises.push(
        createNotification({
          userId: selectedLeadId,
          type: 'PROJECT_ASSIGNED',
          title: 'New Project Assignment',
          message: `You have been assigned as the Team Lead for project "${name}".`,
          link: `/lead/projects/${project.id}`,
        })
      );

      // Notify Team Members
      selectedMemberIds.forEach((memberId) => {
        notifyPromises.push(
          createNotification({
            userId: memberId,
            type: 'PROJECT_ASSIGNED',
            title: 'New Project Assignment',
            message: `You have been assigned as a Member to project "${name}".`,
            link: `/member/projects/${project.id}`,
          })
        );
      });

      // Execute notification creations in background
      Promise.all(notifyPromises).catch((err) =>
        console.error('Failed to send project assignment notifications', err)
      );

      toast({
        title: 'Project Created',
        description: `Project "${name}" created successfully.`,
      });

      // Redirect to individual project dashboard
      router.push(`/projects/${project.id}`);
    } catch (error: any) {
      console.error('Error creating project', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create project.',
        variant: 'destructive',
      });
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

  if (role !== 'PROJECT_MANAGER') {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-2">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground">Only Project Managers can create projects.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Create New Project</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
            <CardDescription>
              Specify details, schedule dates, and assign leadership and team roles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="projectName">Project Name *</Label>
                <Input
                  id="projectName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Hospital Management System"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summarize the project objectives..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                  {startDate && isDatePastOrToday(startDate) && (
                    <p className="text-xs text-amber-600 font-medium">
                      The date you are choosing is in the past or impossible to track.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline *</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    required
                  />
                  {deadline && isDatePastOrToday(deadline) && (
                    <p className="text-xs text-amber-600 font-medium">
                      The date you are choosing is in the past or impossible to track.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="teamLead">Assign Team Lead *</Label>
                <select
                  id="teamLead"
                  value={selectedLeadId}
                  onChange={(e) => setSelectedLeadId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 cursor-pointer"
                >
                  <option value="">Select a team lead</option>
                  {teamLeads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name} ({lead.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <Label>Add Team Members</Label>
                <div className="max-h-48 overflow-y-auto rounded-md border p-3 bg-muted/20 space-y-2">
                  {teamMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center space-x-2 p-1.5 hover:bg-[#7c4d96]/[0.04] hover:ring-[#7c4d96]/20 rounded cursor-pointer transition-colors duration-200"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.includes(member.id)}
                        onChange={() => handleMemberToggle(member.id)}
                        className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                      />
                      <div className="text-sm">
                        <p className="font-medium text-foreground">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </label>
                  ))}
                  {teamMembers.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No team members found. Go to User Management to add users.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating Project...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
