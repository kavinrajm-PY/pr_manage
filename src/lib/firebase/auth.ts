// src/lib/firebase/auth.ts
// Firebase Authentication helpers

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { firebaseApp, getSecondaryApp } from './config';

const auth = getAuth(firebaseApp);

/** Send password reset email */
export async function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email);
}


/** Sign in with email and password */
export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

/** Sign out current user */
export async function signOut() {
  return firebaseSignOut(auth);
}

/**
 * Create a new Firebase Auth user WITHOUT signing out the current PM.
 * Uses a secondary Firebase app instance.
 * Returns the new user's UID.
 */
export async function createAuthUser(
  email: string,
  password: string
): Promise<string> {
  const secondaryApp = getSecondaryApp();
  const secondaryAuth = getAuth(secondaryApp);
  const userCredential = await createUserWithEmailAndPassword(
    secondaryAuth,
    email,
    password
  );
  const uid = userCredential.user.uid;
  // Sign out of secondary app to clean up
  await secondaryAuth.signOut();
  return uid;
}

export { auth };
