'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';

export default function ClientRedirector() {
  const { firebaseUser, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!firebaseUser) {
      router.push('/login');
    } else {
      switch (role) {
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
          router.push('/login');
      }
    }
  }, [firebaseUser, role, loading, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Redirecting to workspace...</p>
      </div>
    </div>
  );
}
