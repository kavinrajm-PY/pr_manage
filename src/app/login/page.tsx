'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signOut } from '@/lib/firebase/auth';
import { getUserById } from '@/services/users';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle, LogIn, Eye, EyeOff, BarChart3, ShieldCheck, Workflow } from 'lucide-react';

export default function LoginPage() {
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
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* ── Left panel (White background, big logo, features list) ── */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-background p-12 border-r border-muted/50">
        <div className="flex-1 flex flex-col justify-center items-center text-center space-y-8">
          <div className="flex flex-col items-center space-y-4">
            <img src="/logo.png" alt="PY Manage Logo" className="w-36 h-36 object-contain drop-shadow-md animate-pulse duration-3000" />
            <div className="space-y-2">
              <h1 className="text-4xl font-black tracking-tight text-primary">PY Manage</h1>
              <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
                Track projects, assign tasks, and measure performance — all in one clean place.
              </p>
            </div>
          </div>

          <div className="w-full max-w-sm border-t border-muted/60 pt-6 space-y-4">
            <div className="flex items-start gap-3.5 text-left">
              <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <BarChart3 className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">Advanced Analytics</h3>
                <p className="text-xs text-muted-foreground">Monitor real-time progress history and individual metrics.</p>
              </div>
            </div>
            <div className="flex items-start gap-3.5 text-left">
              <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">Access Management</h3>
                <p className="text-xs text-muted-foreground">Secure role provisioning, rules, and activity controls.</p>
              </div>
            </div>
            <div className="flex items-start gap-3.5 text-left">
              <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Workflow className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">Simplified Delegation</h3>
                <p className="text-xs text-muted-foreground">Assign projects, manage deadlines, and update status timelines.</p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground text-xs text-center font-medium">
          &copy; {new Date().getFullYear()} PY Manage. Internal use only.
        </p>
      </div>

      {/* ── Right panel (Purple gradient, enlarged login card) ── */}
      <div
        className="flex-1 flex items-center justify-center px-6 py-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #3b1f56 0%, #58326A 50%, #7c4d96 100%)' }}
      >
        {/* Decorative background lights */}
        <div className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-60px] right-[-60px] w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />

        <div className="w-full max-w-lg bg-background shadow-2xl rounded-2xl p-10 space-y-6 border border-white/10 z-10">
          <div className="space-y-1">
            <h3 className="text-3xl font-extrabold tracking-tight text-foreground">Welcome back</h3>
            <p className="text-muted-foreground text-sm">Enter your details below to access your account.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-12 text-base px-4 focus-visible:ring-primary/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 text-base px-4 pr-12 focus-visible:ring-primary/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-4 py-3">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-semibold">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              id="login-submit-btn"
              disabled={loading}
              className="w-full h-12 text-base font-bold gap-2 mt-2 transition-transform active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #58326A, #7c4d96)' }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-5 w-5" /> Sign in
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground pt-2">
            Don&apos;t have an account?{' '}
            <span className="font-bold text-foreground">Contact your Project Manager.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
