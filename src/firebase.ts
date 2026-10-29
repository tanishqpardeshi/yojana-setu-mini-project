import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  setDoc, 
  getDoc,
  collection, 
  query, 
  where, 
  onSnapshot,
  deleteDoc,
  serverTimestamp,
  Firestore
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Firestore (supporting custom databaseId from config)
export const db: Firestore = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)')
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Connectivity validation per Firebase integration guidelines
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firebase] Firestore connected successfully');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Firestore client appears offline, falling back to local cache.');
    } else {
      // In normal operation, document 'test/connection' may not exist, which is expected.
      console.log('[Firebase] Firestore connection initialized');
    }
  }
}
testFirestoreConnection();

export interface UserProfileDoc {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'citizen' | 'operator' | 'admin';
  samagraId?: string;
  wardNumber?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface FirestoreApplicationDoc {
  arn: string;
  schemeId: string;
  schemeName: string;
  applicantName: string;
  applicantUid: string;
  aadhaarLast4?: string;
  samagraId?: string;
  wardNumber?: number;
  status: 'Submitted' | 'Under_Verification' | 'Field_Inspection' | 'Approved' | 'Disbursed' | 'Rejected';
  appliedAt: string;
  amountEstimated?: number;
}

// Helper functions for Auth & Firestore
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Upsert user profile to Firestore
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const existing = await getDoc(userRef);
      
      const role: 'citizen' | 'operator' | 'admin' = 
        user.email === 'admin@yojanasetu.gov.in' ? 'admin' :
        user.email?.includes('csc') || user.email?.includes('operator') ? 'operator' : 'citizen';

      if (!existing.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Citizen of Indore',
          photoURL: user.photoURL || '',
          role,
          createdAt: new Date().toISOString(),
        });
      } else {
        await setDoc(userRef, {
          displayName: user.displayName || existing.data()?.displayName,
          photoURL: user.photoURL || existing.data()?.photoURL,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    }
    return user;
  } catch (error) {
    console.error('[Firebase Auth] Sign in error:', error);
    throw error;
  }
}

export async function logOutUser(): Promise<void> {
  await signOut(auth);
}

export async function saveSchemeToUserFirestore(uid: string, schemeId: string, schemeTitle: string): Promise<void> {
  const schemeRef = doc(db, 'users', uid, 'savedSchemes', schemeId);
  await setDoc(schemeRef, {
    schemeId,
    schemeTitle,
    savedAt: new Date().toISOString(),
  });
}

export async function removeSavedSchemeFromUserFirestore(uid: string, schemeId: string): Promise<void> {
  const schemeRef = doc(db, 'users', uid, 'savedSchemes', schemeId);
  await deleteDoc(schemeRef);
}

export async function saveApplicationToFirestore(appData: FirestoreApplicationDoc): Promise<void> {
  const appRef = doc(db, 'applications', appData.arn);
  await setDoc(appRef, {
    ...appData,
  });
}
