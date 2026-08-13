// src/app/page.tsx
// Root route checking auth state on the server. If no cookie, redirects to login instantly.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ClientRedirector from './ClientRedirector';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('firebase-auth-token')?.value;

  if (!token) {
    redirect('/login');
  }

  // If token is present, let client context check the Firestore role and redirect.
  return <ClientRedirector />;
}
