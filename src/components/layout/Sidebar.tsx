'use client';

// src/components/layout/Sidebar.tsx
// Role-aware sidebar navigation. Renders different links based on user role.

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { signOut } from '@/lib/firebase/auth';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  LogOut,
  CalendarDays,
  BarChart2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

function pmNavItems(): NavItem[] {
  return [
    { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { href: '/projects', label: 'Projects', icon: <FolderKanban className="w-4 h-4" /> },
    { href: '/users', label: 'Users', icon: <Users className="w-4 h-4" /> },
    { href: '/leaves', label: 'Leave Requests', icon: <CalendarDays className="w-4 h-4" /> },
    { href: '/reports', label: 'Reports', icon: <BarChart2 className="w-4 h-4" /> },
  ];
}

function leadNavItems(): NavItem[] {
  return [
    { href: '/lead/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { href: '/lead/projects', label: 'Lead Projects', icon: <FolderKanban className="w-4 h-4" /> },
    { href: '/member/projects', label: 'Member Projects', icon: <FolderKanban className="w-4 h-4" /> },
    { href: '/member/tasks', label: 'My Member Tasks', icon: <CheckSquare className="w-4 h-4" /> },
  ];
}

function memberNavItems(): NavItem[] {
  return [
    { href: '/member/tasks', label: 'My Tasks', icon: <CheckSquare className="w-4 h-4" /> },
    { href: '/member/projects', label: 'My Projects', icon: <FolderKanban className="w-4 h-4" /> },
    { href: '/member/leaves', label: 'Leave Requests', icon: <CalendarDays className="w-4 h-4" /> },
  ];
}

export function Sidebar() {
  const { userProfile, role } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const navItems =
    role === 'PROJECT_MANAGER'
      ? pmNavItems()
      : role === 'TEAM_LEAD'
        ? leadNavItems()
        : memberNavItems();

  async function handleSignOut() {
    await signOut();
    document.cookie = 'firebase-auth-token=; path=/; max-age=0';
    router.push('/login');
  }

  return (
    <aside className="flex flex-col w-60 min-h-screen border-r bg-card px-3 py-4">
      {/* Brand - Horizontal Flex Row */}
      <div className="flex items-center gap-4 px-1 mb-4 border-b border-muted/50 pb-4 min-w-0">
        <Image
          src="/logo.png"
          alt="Praskla Logo"
          width={48}
          height={48}
          className="object-contain flex-shrink-0"
        />
        <div className="-ml-2.5 flex flex-col justify-center min-w-0 pr-1">
          <span className="text-base font-extrabold tracking-tight text-foreground leading-tight truncate">
            PY Manage
          </span>
          <span className="text-[10px] text-muted-foreground leading-tight capitalize font-semibold tracking-wider mt-0.5 truncate">
            {role?.replace('_', ' ').toLowerCase() ?? ''}
          </span>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator className="my-4" />

      {/* User info + sign out */}
      <div className="space-y-2">
        {userProfile && (
          <div className="px-3 py-2">
            <p className="text-sm font-medium leading-tight truncate">{userProfile.name}</p>
            <p className="text-xs text-muted-foreground truncate">{userProfile.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground gap-3"
          onClick={handleSignOut}
          id="signout-btn"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
