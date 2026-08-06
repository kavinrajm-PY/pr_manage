'use client';

// src/lib/auth/AuthContext.tsx
// Provides the current Firebase user + Firestore user profile to the whole app.
// Optimizations:
//   - Reads profile from sessionStorage on first load for instant render (no full-screen spinner)
//   - Signs out inactive users automatically if they navigate while deactivated
//   - Updates sessionStorage on every successful profile fetch

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase/config';
import { db } from '@/lib/firebase/firestore';
import { User, UserRole } from '@/types';
import { signOut } from '@/lib/firebase/auth';

const CACHE_KEY = 'py_manage_profile';

function readCachedProfile(): User | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(profile: User | null) {
  try {
    if (profile) {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(profile));
    } else {
      sessionStorage.removeItem(CACHE_KEY);
    }
  } catch {
    // sessionStorage unavailable (SSR or private mode) — ignore
  }
}

function clearAuthCookie() {
  if (typeof document !== 'undefined') {
    document.cookie = 'firebase-auth-token=; path=/; max-age=0';
  }
}

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  userProfile: User | null;
  role: UserRole | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  userProfile: null,
  role: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  // Initialise from sessionStorage immediately — eliminates cold-start spinner
  const [userProfile, setUserProfile] = useState<User | null>(readCachedProfile);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth(firebaseApp);
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        // Fetch the Firestore profile
        const userDocRef = doc(db, 'users', fbUser.uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const profile = userSnap.data() as User;

          // ── INACTIVE USER GUARD ──────────────────────────────────────────
          if (profile.isActive === false) {
            // Kick the user out — sign out, clear cookie & cache
            writeCachedProfile(null);
            clearAuthCookie();
            await signOut();
            setUserProfile(null);
            setFirebaseUser(null);
            setLoading(false);
            return;
          }
          // ────────────────────────────────────────────────────────────────

          writeCachedProfile(profile);
          setUserProfile(profile);
        } else {
          writeCachedProfile(null);
          setUserProfile(null);
        }
      } else {
        writeCachedProfile(null);
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        role: userProfile?.role ?? null,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
