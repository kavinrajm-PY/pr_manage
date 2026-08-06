import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth/AuthContext';
import { Toaster } from '@/components/ui/toast';
import './globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PY Manage — Internal Project Management',
  description: 'Internal project management system for tracking projects, tasks, and team progress.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full antialiased bg-background text-foreground">
        <AuthProvider>
          <Toaster>
            {children}
          </Toaster>
        </AuthProvider>
      </body>
    </html>
  );
}
