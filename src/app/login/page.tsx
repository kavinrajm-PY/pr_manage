'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signOut } from '@/lib/firebase/auth';
import { getUserById } from '@/services/users';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle, LogIn, Eye, EyeOff, Layers } from 'lucide-react';

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
    <div className="min-h-screen flex bg-background">
      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between items-center w-[35%] min-h-screen p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #2e1843 0%, #462554 50%, #5c3570 100%)' }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-[-80px] left-[-80px] w-80 h-80 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-60px] right-[-60px] w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 right-0 w-48 h-96 rounded-l-full opacity-10"
          style={{ background: 'radial-gradient(circle, #c084fc 0%, transparent 70%)' }} />

        {/* Brand */}
        <div className="relative z-10 flex flex-col items-center text-center gap-5 w-full">
          <div className="bg-white p-5 rounded-2xl shadow-2xl w-32 h-32 flex items-center justify-center border border-white/20 transition-all duration-300 hover:scale-105 hover:shadow-purple-500/10">
            <img src="/logo.png" alt="PY Manage Logo" className="w-24 h-24 object-contain" />
          </div>
          <span className="text-white font-black text-3xl tracking-tight drop-shadow-sm">PY Manage</span>
        </div>

        {/* Hero content */}
        <div className="relative z-10 space-y-6 flex flex-col items-center text-center w-full">
          <div className="w-12 h-1 rounded-full bg-purple-300/60" />
          <h1 className="text-4xl font-extrabold text-white leading-tight drop-shadow-sm">
            Manage your team<br />
            <span className="text-purple-200">with confidence.</span>
          </h1>
          <p className="text-purple-200/80 text-sm leading-relaxed max-w-sm">
            Track projects, assign tasks, and measure performance — all in one place.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 pt-2 max-w-md">
            {['Project Tracking', 'Task Management', 'Team Analytics', 'Performance Reports'].map((f) => (
              <span
                key={f}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-purple-100 border border-purple-400/30 transition-all duration-200 hover:scale-105 hover:bg-white/10 cursor-default"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Footer text */}
        <p className="relative z-10 text-purple-300/60 text-xs text-center w-full">
          © {new Date().getFullYear()} PY Manage. Internal use only.
        </p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-muted/10 relative">
        {/* Soft glowing background element */}
        <div className="absolute inset-0 pointer-events-none opacity-20"
          style={{ background: 'radial-gradient(circle at center, rgba(124, 77, 150, 0.08) 0%, transparent 65%)' }} />

        <div className="w-full max-w-xl bg-background border border-muted-foreground/15 shadow-2xl rounded-3xl p-12 space-y-10 relative overflow-hidden transition-all duration-300 hover:shadow-purple-500/5">

          {/* Brand Header Removed - Large Form Title */}
          <div className="space-y-2 text-center pb-2">
            <h2 className="text-4xl font-black tracking-tight text-foreground">Sign In</h2>
            <p className="text-muted-foreground text-sm font-medium">Enter your credentials to access your workspace</p>
          </div>

          {/* Form */}
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

          <p className="text-center text-base text-muted-foreground">
            Don&apos;t have an account?{' '}
            <span className="font-semibold text-foreground">Contact your Project Manager.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
