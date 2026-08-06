'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signOut } from '@/lib/firebase/auth';
import { getUserById } from '@/services/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Briefcase } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const credential = await signIn(email, password);
      const uid = credential.user.uid;

      // Set a simple cookie so middleware knows the user is authenticated
      document.cookie = `firebase-auth-token=${uid}; path=/; max-age=86400`;

      // Fetch role from Firestore
      const userProfile = await getUserById(uid);
      if (!userProfile) {
        setError('User profile not found. Contact your administrator.');
        await signOut();
        document.cookie = 'firebase-auth-token=; path=/; max-age=0';
        setLoading(false);
        return;
      }

      // Block inactive users
      if (userProfile.isActive === false) {
        setError('Your account has been deactivated. Please contact your Project Manager.');
        await signOut();
        document.cookie = 'firebase-auth-token=; path=/; max-age=0';
        setLoading(false);
        return;
      }

      // Role-based redirect
      switch (userProfile.role) {
        case 'PROJECT_MANAGER':
          router.push('/dashboard');
          break;
        case 'TEAM_LEAD':
          router.push('/lead/dashboard');
          break;
        case 'TEAM_MEMBER':
          router.push('/member/tasks');
          break;
        default:
          router.push('/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials.';
      if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) {
        setError('Incorrect email or password.');
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="/logo.png"
            alt="Praskla Logo"
            className="w-28 h-28 object-contain mb-3"
          />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">PY Manage</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">Internal Project Management</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign in</CardTitle>
            <CardDescription>Enter your work email and password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                id="login-submit-btn"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Contact your Project Manager if you don&apos;t have an account.
        </p>
      </div>
    </div>
  );
}
