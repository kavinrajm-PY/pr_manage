'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signOut } from '@/lib/firebase/auth';
import { getUserById } from '@/services/users';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle, LogIn, Eye, EyeOff } from 'lucide-react';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const credential = await signIn(email, password);
      const uid = credential.user.uid;
      document.cookie = `firebase-auth-token=${uid}; path=/; max-age=86400`;
      const userProfile = await getUserById(uid);
      if (!userProfile) {
        setError('User profile not found. Contact your administrator.');
        await signOut();
        document.cookie = 'firebase-auth-token=; path=/; max-age=0';
        setLoading(false);
        return;
      }
      if (userProfile.isActive === false) {
        setError('Your account has been deactivated. Please contact your Project Manager.');
        await signOut();
        document.cookie = 'firebase-auth-token=; path=/; max-age=0';
        setLoading(false);
        return;
      }
      switch (userProfile.role) {
        case 'PROJECT_MANAGER': router.push('/dashboard'); break;
        case 'TEAM_LEAD': router.push('/lead/dashboard'); break;
        case 'TEAM_MEMBER': router.push('/member/tasks'); break;
        default: router.push('/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials.';
      if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) {
        setError('Incorrect email or password. Please try again.');
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-base font-semibold">Email address</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="h-14 text-lg px-5 rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-base font-semibold">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="h-14 text-lg px-5 pr-14 rounded-xl"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl px-5 py-4">
          <AlertCircle className="h-4.5 w-4.5 mt-0.5 flex-shrink-0" />
          <p className="text-base font-medium">{error}</p>
        </div>
      )}

      <Button
        type="submit"
        id="login-submit-btn"
        disabled={loading}
        className="w-full h-14 text-lg font-semibold gap-2 rounded-xl"
        style={{ background: 'linear-gradient(135deg, #58326A, #7c4d96)' }}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Signing in…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <LogIn className="h-5 w-5" /> Sign in
          </span>
        )}
      </Button>
    </form>
  );
}
