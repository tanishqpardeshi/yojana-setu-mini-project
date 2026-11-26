import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  getDoc,
  deleteDoc,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  AreaType,
  Category,
  CitizenProfile,
  Gender,
  JanpadBlock,
  MaritalStatus,
  OccupationType,
} from './types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Initialize Firestore (supporting custom databaseId from config)
export const db: Firestore =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

// Connectivity validation per Firebase integration guidelines
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Firestore client appears offline, falling back to local cache.');
    }
  }
}
testFirestoreConnection();

export type AuthMethod = 'google' | 'email' | 'samagra';

export interface UserProfileDoc {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phone?: string;
  mobileNumber?: string;
  mobileVerified?: boolean;
  mobileVerificationToken?: string;
  role: 'citizen' | 'admin';
  authMethod?: AuthMethod;
  samagraId?: string;
  samagraFamilyId?: string;
  samagraMemberId?: string;
  areaType?: AreaType;
  wardNumber?: number;
  blockName?: JanpadBlock;
  category?: Category;
  age?: number;
  gender?: Gender;
  annualIncome?: number;
  occupation?: OccupationType;
  isBPL?: boolean;
  hasDisability?: boolean;
  maritalStatus?: MaritalStatus;
  isMpDomicile?: boolean;
  isIndoreResident?: boolean;
  ekycVerified?: boolean;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface CitizenRegistrationInput {
  email: string;
  password: string;
  displayName: string;
  phone: string;
  samagraFamilyId?: string;
  samagraMemberId?: string;
  areaType: AreaType;
  wardNumber?: number;
  blockName?: JanpadBlock;
  category: Category;
  age: number;
  gender: Gender;
  annualIncome: number;
  occupation: OccupationType;
  isBPL: boolean;
  hasDisability: boolean;
  maritalStatus: MaritalStatus;
  isMpDomicile: boolean;
  isIndoreResident: boolean;
}

export interface AuthResult {
  user: User;
  profile: UserProfileDoc;
  isNewUser: boolean;
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

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function clampString(val: string | undefined | null, maxLen: number): string | undefined {
  if (val === undefined || val === null) return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function clampFiniteInt(val: unknown, min: number, max: number): number | undefined {
  if (typeof val !== 'number' || !Number.isFinite(val)) return undefined;
  return Math.min(max, Math.max(min, Math.round(val)));
}

function stripUndefined<T extends object>(obj: T): T {
  const clean = {} as T;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v !== undefined) {
      (clean as Record<string, unknown>)[k] = v;
    }
  }
  return clean;
}

export interface AdminSessionInfo {
  authenticated: boolean;
  uid: string;
  email: string;
  displayName: string;
  role: 'admin';
  adminSource?: string;
}

export interface AdminAuthResult {
  user: User;
  session: AdminSessionInfo;
  idToken: string;
}

// Fetch user profile document from Firestore
export async function fetchUserProfileFromFirestore(uid: string): Promise<UserProfileDoc | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfileDoc;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// Helper to get a fresh Firebase ID token Authorization header for authenticated API calls
export async function getAuthBearerHeader(forceRefresh = false): Promise<Record<string, string>> {
  const currentUser = auth.currentUser;
  if (!currentUser) return {};
  const token = await currentUser.getIdToken(forceRefresh);
  return { Authorization: `Bearer ${token}` };
}

// Verify an authenticated user's Admin role claim with the Express server (/api/admin/session)
export async function verifyAdminSessionWithServer(
  user: User,
  forceRefresh = true
): Promise<{ session: AdminSessionInfo; idToken: string }> {
  const idToken = await user.getIdToken(forceRefresh);
  const res = await fetch('/api/admin/session', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!res.ok) {
    let errMessage = 'Access Denied: This account does not hold verified Administrator privileges.';
    try {
      const data = await res.json();
      if (data?.error) errMessage = data.error;
    } catch {
      // ignore json error
    }
    const deniedErr = new Error(errMessage) as Error & { code?: string };
    deniedErr.code = 'ADMIN_ACCESS_DENIED';
    throw deniedErr;
  }

  const data = await res.json();
  if (!data?.authenticated || data?.role !== 'admin') {
    const deniedErr = new Error(
      'Access Denied: Verified Administrator role claim is required.'
    ) as Error & { code?: string };
    deniedErr.code = 'ADMIN_ACCESS_DENIED';
    throw deniedErr;
  }

  return {
    session: {
      authenticated: true,
      uid: data.uid,
      email: data.email,
      displayName: data.displayName || user.displayName || data.email,
      role: 'admin',
      adminSource: data.adminSource,
    },
    idToken,
  };
}

// Dedicated Admin-Only Sign-In via Google (NO public admin sign-up; strictly verifies server admin claim)
export async function signInAdminWithGoogle(): Promise<AdminAuthResult> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  try {
    const verified = await verifyAdminSessionWithServer(user, true);
    return {
      user,
      session: verified.session,
      idToken: verified.idToken,
    };
  } catch (err) {
    // Isolate failed admin attempts by signing out immediately so no unverified session lingers
    await signOut(auth).catch(() => {});
    throw err;
  }
}

// Dedicated Admin-Only Sign-In via Officer Email & Password (NO public admin sign-up)
export async function signInAdminWithEmail(email: string, password: string): Promise<AdminAuthResult> {
  const cleanEmail = email.trim();
  const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
  const user = result.user;
  try {
    const verified = await verifyAdminSessionWithServer(user, true);
    return {
      user,
      session: verified.session,
      idToken: verified.idToken,
    };
  } catch (err) {
    await signOut(auth).catch(() => {});
    throw err;
  }
}

// Citizen-Only Sign-In / Sign-Up via Google Popup (strictly assigns ONLY 'citizen' role)
export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const now = new Date().toISOString();
    const userPath = `users/${user.uid}`;
    const userRef = doc(db, 'users', user.uid);

    let isNewUser = false;
    let profile: UserProfileDoc;

    try {
      const existing = await getDoc(userRef);

      if (!existing.exists()) {
        isNewUser = true;
        profile = stripUndefined<UserProfileDoc>({
          uid: user.uid,
          email: clampString(user.email, 160) || '',
          displayName: clampString(user.displayName, 120) || 'Citizen of Indore',
          photoURL: clampString(user.photoURL, 500),
          role: 'citizen',
          authMethod: 'google',
          isMpDomicile: true,
          isIndoreResident: true,
          ekycVerified: false,
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
        });
        await setDoc(userRef, profile);
      } else {
        const prev = existing.data() as UserProfileDoc;
        const updates = stripUndefined({
          displayName: clampString(user.displayName, 120) || prev.displayName,
          photoURL: clampString(user.photoURL, 500) || prev.photoURL,
          authMethod: 'google' as const,
          updatedAt: now,
          lastLoginAt: now,
        });
        await setDoc(userRef, updates, { merge: true });
        profile = { ...prev, ...updates, role: 'citizen' };
      }
    } catch (fsErr) {
      handleFirestoreError(fsErr, OperationType.WRITE, userPath);
    }

    return { user, profile, isNewUser };
  } catch (error) {
    console.error('[Firebase Auth] Citizen Google Sign-In error:', error);
    throw error;
  }
}

// Register a new Citizen account via Email & Password + create Firestore UserProfile (strictly 'citizen' role)
export async function registerCitizenWithEmail(input: CitizenRegistrationInput): Promise<AuthResult> {
  const cleanEmail = input.email.trim();
  const credential = await createUserWithEmailAndPassword(auth, cleanEmail, input.password);
  const user = credential.user;

  const cleanName = clampString(input.displayName, 120) || 'Citizen of Indore';
  await updateProfile(user, { displayName: cleanName });

  const now = new Date().toISOString();
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  const clampedWard =
    input.areaType === 'urban' ? clampFiniteInt(input.wardNumber, 1, 85) : undefined;
  const clampedAge = clampFiniteInt(input.age, 0, 120) ?? 30;
  const clampedIncome = clampFiniteInt(input.annualIncome, 0, 100000000) ?? 0;

  const profile = stripUndefined<UserProfileDoc>({
    uid: user.uid,
    email: clampString(cleanEmail, 160) || '',
    displayName: cleanName,
    phone: clampString(input.phone, 20),
    role: 'citizen',
    authMethod: 'email',
    samagraId: clampString(input.samagraMemberId || input.samagraFamilyId, 16),
    samagraFamilyId: clampString(input.samagraFamilyId, 16),
    samagraMemberId: clampString(input.samagraMemberId, 16),
    areaType: input.areaType,
    wardNumber: clampedWard,
    blockName: input.areaType === 'rural' ? input.blockName : undefined,
    category: input.category,
    age: clampedAge,
    gender: input.gender,
    annualIncome: clampedIncome,
    occupation: input.occupation,
    isBPL: input.isBPL,
    hasDisability: input.hasDisability,
    maritalStatus: input.maritalStatus,
    isMpDomicile: input.isMpDomicile,
    isIndoreResident: input.isIndoreResident,
    ekycVerified: Boolean(clampString(input.samagraMemberId, 16)),
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  });

  try {
    await setDoc(userRef, profile);
  } catch (fsErr) {
    handleFirestoreError(fsErr, OperationType.CREATE, userPath);
  }

  return { user, profile, isNewUser: true };
}

// Login an existing Citizen via Email & Password + hydrate & update Firestore UserProfile (strictly 'citizen' scope)
export async function loginCitizenWithEmail(email: string, password: string): Promise<AuthResult> {
  const cleanEmail = email.trim();
  const credential = await signInWithEmailAndPassword(auth, cleanEmail, password);
  const user = credential.user;
  const now = new Date().toISOString();
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  try {
    const existing = await getDoc(userRef);
    let profile: UserProfileDoc;

    if (!existing.exists()) {
      profile = stripUndefined<UserProfileDoc>({
        uid: user.uid,
        email: clampString(user.email, 160) || clampString(cleanEmail, 160) || '',
        displayName: clampString(user.displayName, 120) || 'Citizen of Indore',
        role: 'citizen',
        authMethod: 'email',
        isMpDomicile: true,
        isIndoreResident: true,
        ekycVerified: false,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      });
      await setDoc(userRef, profile);
    } else {
      const prev = existing.data() as UserProfileDoc;
      const updates = {
        authMethod: 'email' as const,
        updatedAt: now,
        lastLoginAt: now,
      };
      await setDoc(userRef, updates, { merge: true });
      profile = { ...prev, ...updates, role: 'citizen' };
    }

    return { user, profile, isNewUser: false };
  } catch (fsErr) {
    handleFirestoreError(fsErr, OperationType.WRITE, userPath);
  }
}

export async function resetCitizenPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

// Update allowed citizen profile / Samagra link fields in Firestore
export async function updateCitizenProfileInFirestore(
  uid: string,
  updates: Partial<UserProfileDoc>
): Promise<UserProfileDoc> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);
  const now = new Date().toISOString();

  try {
    const snap = await getDoc(userRef);
    const existingData = snap.exists() ? (snap.data() as UserProfileDoc) : undefined;
    const effectiveAreaType = updates.areaType ?? existingData?.areaType;

    const resolvedWard =
      effectiveAreaType === 'rural'
        ? undefined
        : clampFiniteInt(updates.wardNumber, 1, 85);
    const resolvedBlock =
      effectiveAreaType === 'urban'
        ? undefined
        : updates.blockName;

    const sanitizedUpdates = stripUndefined({
      displayName: clampString(updates.displayName, 120),
      photoURL: clampString(updates.photoURL, 500),
      phone:
        updates.phone !== undefined ? (clampString(updates.phone, 20) ?? '') : undefined,
      mobileNumber:
        updates.mobileNumber !== undefined
          ? (clampString(updates.mobileNumber, 20) ?? '')
          : undefined,
      mobileVerified:
        updates.mobileVerified !== undefined ? Boolean(updates.mobileVerified) : undefined,
      authMethod: updates.authMethod,
      samagraId:
        updates.samagraId !== undefined ||
        updates.samagraMemberId !== undefined ||
        updates.samagraFamilyId !== undefined
          ? (clampString(
              updates.samagraId || updates.samagraMemberId || updates.samagraFamilyId,
              16
            ) ?? '')
          : undefined,
      samagraFamilyId:
        updates.samagraFamilyId !== undefined
          ? (clampString(updates.samagraFamilyId, 16) ?? '')
          : undefined,
      samagraMemberId:
        updates.samagraMemberId !== undefined
          ? (clampString(updates.samagraMemberId, 16) ?? '')
          : undefined,
      areaType: updates.areaType,
      wardNumber: resolvedWard,
      blockName: resolvedBlock,
      category: updates.category,
      age: clampFiniteInt(updates.age, 0, 120),
      gender: updates.gender,
      annualIncome: clampFiniteInt(updates.annualIncome, 0, 100000000),
      occupation: updates.occupation,
      isBPL: updates.isBPL,
      hasDisability: updates.hasDisability,
      maritalStatus: updates.maritalStatus,
      isMpDomicile: updates.isMpDomicile,
      isIndoreResident: updates.isIndoreResident,
      ekycVerified: updates.ekycVerified,
      updatedAt: now,
      lastLoginAt: updates.lastLoginAt || now,
    });

    if (!existingData) {
      const currentUser = auth.currentUser;
      const resolvedName =
        sanitizedUpdates.displayName || clampString(currentUser?.displayName, 120) || 'Citizen of Indore';
      const newDoc: UserProfileDoc = stripUndefined<UserProfileDoc>({
        ...sanitizedUpdates,
        uid,
        email: clampString(currentUser?.email, 160) || '',
        displayName: resolvedName,
        role: 'citizen',
        createdAt: now,
      });
      await setDoc(userRef, newDoc);
      return newDoc;
    }

    await setDoc(userRef, sanitizedUpdates, { merge: true });
    return {
      ...existingData,
      ...sanitizedUpdates,
      displayName: sanitizedUpdates.displayName || existingData.displayName,
    };
  } catch (fsErr) {
    handleFirestoreError(fsErr, OperationType.UPDATE, userPath);
  }
}

// Convert Firestore UserProfileDoc into active CitizenProfile state
export function mapUserProfileToCitizenProfile(docData: UserProfileDoc, prev: CitizenProfile): CitizenProfile {
  return {
    ...prev,
    fullName: docData.displayName || prev.fullName,
    age: docData.age ?? prev.age,
    gender: docData.gender || prev.gender,
    category: docData.category || prev.category,
    areaType: docData.areaType || prev.areaType,
    wardNumber:
      (docData.areaType || prev.areaType) === 'urban'
        ? docData.wardNumber ?? prev.wardNumber ?? 72
        : undefined,
    blockName:
      (docData.areaType || prev.areaType) === 'rural'
        ? docData.blockName ?? prev.blockName ?? 'Indore'
        : undefined,
    annualIncome: docData.annualIncome ?? prev.annualIncome,
    occupation: docData.occupation || prev.occupation,
    isBPL: docData.isBPL ?? prev.isBPL,
    hasDisability: docData.hasDisability ?? prev.hasDisability,
    maritalStatus: docData.maritalStatus || prev.maritalStatus,
    isMpDomicile: docData.isMpDomicile ?? prev.isMpDomicile,
    isIndoreResident: docData.isIndoreResident ?? prev.isIndoreResident,
    phone: docData.mobileNumber || docData.phone || prev.phone,
    samagraFamilyId: docData.samagraFamilyId || prev.samagraFamilyId,
    samagraMemberId: docData.samagraMemberId || prev.samagraMemberId,
    verifiedDocuments: {
      ...prev.verifiedDocuments,
      samagra_family: {
        verified: Boolean(docData.samagraFamilyId || prev.samagraFamilyId),
        source: 'mp_edistrict',
        docNumber: docData.samagraFamilyId ? `SPR-${docData.samagraFamilyId}` : prev.verifiedDocuments.samagra_family?.docNumber,
      },
      samagra_member: {
        verified: Boolean(docData.samagraMemberId || docData.ekycVerified),
        source: 'mp_edistrict',
        docNumber: docData.samagraMemberId ? `SPR-${docData.samagraMemberId}` : prev.verifiedDocuments.samagra_member?.docNumber,
      },
    },
  };
}

export async function logOutUser(): Promise<void> {
  await signOut(auth);
}

export async function saveSchemeToUserFirestore(uid: string, schemeId: string, schemeTitle: string): Promise<void> {
  const path = `users/${uid}/savedSchemes/${schemeId}`;
  try {
    const schemeRef = doc(db, 'users', uid, 'savedSchemes', schemeId);
    await setDoc(schemeRef, {
      schemeId: clampString(schemeId, 64) || schemeId,
      schemeTitle: clampString(schemeTitle, 200) || schemeTitle,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeSavedSchemeFromUserFirestore(uid: string, schemeId: string): Promise<void> {
  const path = `users/${uid}/savedSchemes/${schemeId}`;
  try {
    const schemeRef = doc(db, 'users', uid, 'savedSchemes', schemeId);
    await deleteDoc(schemeRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveApplicationToFirestore(appData: FirestoreApplicationDoc): Promise<void> {
  const cleanArn = clampString(appData.arn, 64) || appData.arn;
  const path = `applications/${cleanArn}`;
  try {
    const appRef = doc(db, 'applications', cleanArn);
    await setDoc(appRef, stripUndefined({
      ...appData,
      arn: cleanArn,
      schemeId: clampString(appData.schemeId, 64) || 'unknown_scheme',
      schemeName: clampString(appData.schemeName, 200),
      applicantName: clampString(appData.applicantName, 120) || 'Citizen Applicant',
      samagraId: clampString(appData.samagraId, 16),
      aadhaarLast4: clampString(appData.aadhaarLast4, 4),
      wardNumber: clampFiniteInt(appData.wardNumber, 1, 85),
      amountEstimated: clampFiniteInt(appData.amountEstimated, 0, 100000000),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
