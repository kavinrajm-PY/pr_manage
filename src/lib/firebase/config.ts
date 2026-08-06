// src/lib/firebase/config.ts
// Firebase app initialization — centralized, imported everywhere

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';

const hasEnv = process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
                 process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'your_api_key_here';

const firebaseConfig = {
  apiKey: hasEnv ? process.env.NEXT_PUBLIC_FIREBASE_API_KEY : 'AIzaSyA1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q',
  authDomain: hasEnv ? process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN : 'dummy-project.firebaseapp.com',
  projectId: hasEnv ? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID : 'dummy-project',
  storageBucket: hasEnv ? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET : 'dummy-project.appspot.com',
  messagingSenderId: hasEnv ? process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID : '1234567890',
  appId: hasEnv ? process.env.NEXT_PUBLIC_FIREBASE_APP_ID : '1:1234567890:web:1a2b3c4d5e6f7g8h',
};

// Primary Firebase app (singleton)
export const firebaseApp: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Secondary app used for creating new users without signing out the PM.
// We lazily initialize it only when needed (see services/users.ts).
let secondaryApp: FirebaseApp | null = null;

export function getSecondaryApp(): FirebaseApp {
  if (secondaryApp) return secondaryApp;
  // Use a unique name so it doesn't conflict with the primary app
  secondaryApp = initializeApp(firebaseConfig, 'secondary');
  return secondaryApp;
}
