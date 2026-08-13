// src/app/login/page.tsx
// PM only login page. Server-rendered wrapper with a client-side login form.

import LoginForm from './LoginForm';
import Image from 'next/image';

export default function LoginPage() {
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
            <Image
              src="/logo.png"
              alt="PY Manage Logo"
              width={96}
              height={96}
              className="object-contain"
              priority
            />
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

          <LoginForm />

          <p className="text-center text-base text-muted-foreground">
            Don&apos;t have an account?{' '}
            <span className="font-semibold text-foreground">Contact your Project Manager.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
