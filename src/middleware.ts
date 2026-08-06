// src/middleware.ts
// Protects routes from unauthenticated access.
// Since Firebase Auth is client-side, this middleware checks for the Firebase
// session cookie pattern and redirects unauthenticated users to /login.
// Full role-based enforcement is done on the client via AuthContext + useAuth.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for Firebase Auth session token in cookies
  // Firebase sets "__session" cookie when using Firebase Hosting + Auth.
  // For client-side Firebase SDK, we check a custom cookie we set on login.
  const sessionCookie =
    request.cookies.get('__session')?.value ||
    request.cookies.get('firebase-auth-token')?.value;

  if (!sessionCookie) {
    // No session — redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
