// src/lib/firebase/firestore.ts
// Firestore instance export

import { getFirestore } from 'firebase/firestore';
import { firebaseApp } from './config';

export const db = getFirestore(firebaseApp);
