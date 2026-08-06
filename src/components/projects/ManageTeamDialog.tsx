'use client';

// src/components/projects/ManageTeamDialog.tsx
// Dialog for Project Manager to dynamically manage project team members and lead assignments.

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Project, User } from '@/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getUsersByRole } from '@/services/users';
import { addProjectMember, removeUserFromProject } from '@/services/projectMembers';
import { createNotification } from '@/services/notifications';
import { Users, Settings, Loader2 } from 'lucide-react';

interface ManageTeamDialogProps {
  project: Project;
  currentLead: User | null;
  currentMembers: User[];
  onTeamUpdated: () => void;
}

export function ManageTeamDialog({ project, currentLead, currentMembers, onTeamUpdated }: ManageTeamDialogProps) {
  const { firebaseUser } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);

  // Available users in system
  const [allLeads, setAllLeads] = useState<User[]>([]);
  const [allMembers, setAllMembers] = useState<User[]>([]);

  // Selected values
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Load available users when dialog opens
  useEffect(() => {
    if (!open) return;

    async function loadWorkspaceUsers() {
      setLoadingUsers(true);
      try {
        const [leads, members] = await Promise.all([
          getUsersByRole('TEAM_LEAD'),
          getUsersByRole('TEAM_MEMBER'),
        ]);

        // Only active users can be selected for new assignments.
        // However, if the currently assigned lead/members are inactive,
        // we still inject them so their name shows (not a raw UID), but
        // mark them as disabled so they can't be re-selected.
        const activeLeads = leads.filter((l) => l.isActive !== false);
        const leadIds = new Set(activeLeads.map((l) => l.id));
        const leadsWithCurrent = currentLead && !leadIds.has(currentLead.id)
          ? [currentLead, ...activeLeads]  // current inactive lead appears first, disabled
          : activeLeads;
        setAllLeads(leadsWithCurrent);

        const activeMembers = members.filter((m) => m.isActive !== false);
        const memberIds = new Set(activeMembers.map((m) => m.id));
        const membersWithCurrent = [
          ...activeMembers,
          // inject currently-assigned inactive members so names render, not UIDs
          ...(currentMembers || []).filter((m) => !memberIds.has(m.id) && m.isActive === false),
        ];
        setAllMembers(membersWithCurrent);

        // Pre-populate current assignments
        setSelectedLeadId(currentLead?.id || '');
        setSelectedMemberIds((currentMembers || []).filter(Boolean).map((m) => m.id));
      } catch (error) {
        console.error('Failed to load users', error);
        toast({
          title: 'Error',
          description: 'Failed to load system users list.',
          variant: 'destructive',
        });
      } finally {
        setLoadingUsers(false);
      }
    }

    loadWorkspaceUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleMemberToggle = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  async function handleSaveChanges() {
    if (!firebaseUser) return;
    if (!selectedLeadId) {
      toast({
        title: 'Validation Error',
        description: 'You must assign a Team Lead to the project.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const notifyPromises: Promise<any>[] = [];

      // ─── 1. Handle Team Lead update ──────────────────────────────────────────
      if (selectedLeadId !== (currentLead?.id || '')) {
        // Remove old lead membership if existed
        if (currentLead) {
          await removeUserFromProject(project.id, currentLead.id);
        }
        // Add new lead membership
        await addProjectMember({
          projectId: project.id,
          userId: selectedLeadId,
          role: 'TEAM_LEAD',
        });

        // Notify new Lead
        notifyPromises.push(
          createNotification({
            userId: selectedLeadId,
            type: 'PROJECT_ASSIGNED',
            title: 'Project Lead Assignment',
            message: `You have been assigned as the Team Lead for project "${project.name}".`,
            link: `/lead/projects/${project.id}`,
          })
        );
      }

      // ─── 2. Handle Team Members updates ──────────────────────────────────────
      const currentMemberIds = currentMembers.map((m) => m.id);

      // Find members to remove
      const membersToRemove = currentMemberIds.filter((id) => !selectedMemberIds.includes(id));
      // Find members to add
      const membersToAdd = selectedMemberIds.filter((id) => !currentMemberIds.includes(id));

      // Remove members in batch
      await Promise.all(
        membersToRemove.map((memberId) => removeUserFromProject(project.id, memberId))
      );

      // Add new members and construct notifications
      await Promise.all(
        membersToAdd.map(async (memberId) => {
          await addProjectMember({
            projectId: project.id,
            userId: memberId,
            role: 'TEAM_MEMBER',
          });

          notifyPromises.push(
            createNotification({
              userId: memberId,
              type: 'PROJECT_ASSIGNED',
              title: 'Project Member Assignment',
              message: `You have been assigned as a Member to project "${project.name}".`,
              link: `/member/projects/${project.id}`,
            })
          );
        })
      );

      // Send notifications in background
      Promise.all(notifyPromises).catch((err) =>
        console.error('Failed to trigger project membership notifications', err)
      );

      toast({
        title: 'Success',
        description: 'Project team assignments updated successfully.',
      });

      setOpen(false);
      onTeamUpdated();
    } catch (error: any) {
      console.error('Failed to update project team assignments', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update team assignments.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
          <Settings className="w-3.5 h-3.5" /> Manage Team
        </Button>
      } />
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Manage Project Team
          </DialogTitle>
          <DialogDescription>
            Modify who is assigned to project tasks and lead responsibilities.
          </DialogDescription>
        </DialogHeader>

        {loadingUsers ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 py-4">
            {/* Team Lead Selection */}
            <div className="space-y-2">
              <Label htmlFor="lead-select" className="text-xs font-bold text-muted-foreground uppercase">
                Assign Team Lead *
              </Label>
              <select
                id="lead-select"
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 cursor-pointer font-medium"
              >
                <option value="">Select Team Lead</option>
                {allLeads.map((lead) => (
                  <option
                    key={lead.id}
                    value={lead.id}
                    disabled={lead.isActive === false}
                  >
                    {lead.name} ({lead.email}){lead.isActive === false ? ' — Inactive' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Team Members List Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase">
                Assign Team Members ({selectedMemberIds.length} selected)
              </Label>
              <div className="max-h-60 overflow-y-auto border rounded-md p-3 divide-y divide-muted/50 bg-card">
                {allMembers.map((member) => {
                  const isChecked = selectedMemberIds.includes(member.id);
                  const isInactive = member.isActive === false;
                  return (
                    <div
                      key={member.id}
                      onClick={() => !isInactive && handleMemberToggle(member.id)}
                      className={`flex items-center justify-between py-2 px-1 rounded-sm transition-colors text-sm ${
                        isInactive
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {member.name}{isInactive ? ' (Inactive)' : ''}
                        </span>
                        <span className="text-xs text-muted-foreground">{member.email}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isInactive}
                        onChange={() => {}}
                        className="h-4.5 w-4.5 rounded border-muted-foreground text-primary focus:ring-primary cursor-pointer accent-primary disabled:cursor-not-allowed"
                      />
                    </div>
                  );
                })}
                {allMembers.length === 0 && (
                  <p className="text-center py-6 text-xs text-muted-foreground">
                    No Team Members registered in the system.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSaveChanges} disabled={saving || loadingUsers}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              'Save Assignments'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
