'use client';

// src/app/users/page.tsx
// PM only page to view all users and create new users.

import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/auth/AuthContext';
import { getAllUsers, createUser } from '@/services/users';
import { User, UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, ShieldAlert } from 'lucide-react';
import { UserDetailsDialog } from '@/components/users/UserDetailsDialog';
import { useRouter } from 'next/navigation';

export default function UsersPage() {
  const { role, userProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail Modal states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  function handleUserUpdated(updatedUser: User) {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    if (selectedUser?.id === updatedUser.id) {
      setSelectedUser(updatedUser);
    }
  }

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('TEAM_MEMBER');
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && role !== 'PROJECT_MANAGER') {
      router.push('/login');
    }
  }, [role, loading, router]);

  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await getAllUsers();
        setUsers(data);
      } catch (error) {
        console.error('Failed to fetch users', error);
      } finally {
        setLoading(false);
      }
    }
    if (role === 'PROJECT_MANAGER') {
      loadUsers();
    }
  }, [role]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) return;

    setSubmitting(true);
    try {
      const newUser = await createUser({
        name,
        email,
        password,
        role: userRole,
      });

      setUsers((prev) => [...prev, newUser]);
      setOpen(false);
      
      // Reset form
      setName('');
      setEmail('');
      setPassword('');
      setUserRole('TEAM_MEMBER');

      toast({
        title: 'User created successfully',
        description: `${name} has been added as a ${userRole.replace('_', ' ').toLowerCase()}.`,
      });
    } catch (error: any) {
      console.error('Failed to create user', error);
      toast({
        title: 'Error creating user',
        description: error.message || 'An unexpected error occurred.',
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
          <p className="text-muted-foreground">Only Project Managers can access the users panel.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={
              <Button id="add-user-btn" className="gap-2">
                <Plus className="h-4 w-4" /> Add User
              </Button>
            } />
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
                <DialogDescription>
                  Create credentials and assign a role to a new team member.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Sharma"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Work Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. rahul@company.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Temporary Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as UserRole)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 cursor-pointer"
                  >
                    <option value="PROJECT_MANAGER">Project Manager</option>
                    <option value="TEAM_LEAD">Team Lead</option>
                    <option value="TEAM_MEMBER">Team Member</option>
                  </select>
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Create Account'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow
                  key={user.id}
                  onClick={() => {
                    setSelectedUser(user);
                    setDetailsOpen(true);
                  }}
                  className="cursor-pointer"
                >
                  <TableCell className="font-semibold text-foreground">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell className="capitalize text-sm font-medium">
                    {user.role.replace('_', ' ').toLowerCase()}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={user.isActive ? 'IN_PROGRESS' : 'ON_HOLD'} label={user.isActive ? 'Active' : 'Inactive'} />
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* User Details popup workload viewer */}
        <UserDetailsDialog
          user={selectedUser}
          isOpen={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          onUserUpdated={handleUserUpdated}
        />
      </div>
    </AppLayout>
  );
}
