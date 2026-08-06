'use client';

// src/components/layout/AppLayout.tsx
// Main layout wrapper for authenticated screens.
// Renders a skeleton shell immediately (no blank screen) while Firebase Auth resolves.

import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from './Sidebar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationBell } from './NotificationBell';

interface AppLayoutProps {
  children: ReactNode;
}

/** Thin shimmering skeleton bar */
function SkeletonBar({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-muted/60 ${className}`}
      aria-hidden="true"
    />
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const { loading, firebaseUser, userProfile } = useAuth();

  // While auth resolves, render the full shell with skeleton placeholders.
  // This gives instant visual feedback instead of a blank/white screen.
  if (loading) {
    return (
      <div className="flex min-h-screen bg-muted/40">
        {/* Skeleton Sidebar */}
        <div className="hidden md:flex flex-col w-60 min-h-screen border-r bg-card px-3 py-4 gap-4">
          <div className="flex items-center gap-2 pb-4 border-b">
            <SkeletonBar className="w-20 h-20 rounded-lg flex-shrink-0" />
            <div className="space-y-1.5 flex-1">
              <SkeletonBar className="h-3.5 w-24" />
              <SkeletonBar className="h-2.5 w-16" />
            </div>
          </div>
          <div className="space-y-2 flex-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBar key={i} className="h-9 w-full rounded-md" />
            ))}
          </div>
          <SkeletonBar className="h-9 w-full rounded-md" />
        </div>

        {/* Skeleton Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:px-6">
            <SkeletonBar className="h-4 w-40" />
            <SkeletonBar className="h-8 w-8 rounded-full" />
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="space-y-4">
              <SkeletonBar className="h-8 w-56" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonBar key={i} className="h-24 w-full rounded-xl" />
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonBar key={i} className="h-40 w-full rounded-xl" />
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-muted/40">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Global Header */}
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="md:hidden flex items-center gap-2">
              <img
                src="/logo.png"
                alt="Praskla Logo"
                className="w-9 h-9 object-contain flex-shrink-0"
              />
              <span className="text-sm font-bold leading-tight text-foreground">PY Manage</span>
            </div>
            <div className="hidden md:block">
              <span className="text-sm font-medium text-muted-foreground">
                Signed in as <span className="font-semibold text-foreground">{userProfile?.name || firebaseUser.email}</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />

            <Sheet>
              <SheetTrigger render={
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              } />
              <SheetContent side="left" className="p-0 w-60">
                <Sidebar />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
