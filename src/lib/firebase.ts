import { initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, query, orderBy, getDoc, where, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
console.log("Firebase initialized with config:", {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  firestoreDatabaseId: firebaseConfig.firestoreDatabaseId
});
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const signOut = () => firebaseSignOut(auth);

const INVITE_CODE_LENGTH = 6;

function generateInviteCode() {
  let buffer = '';
  while (buffer.length < INVITE_CODE_LENGTH) {
    buffer += Math.random().toString(36).slice(2);
  }
  return buffer.slice(0, INVITE_CODE_LENGTH).toUpperCase();
}

async function createUniqueInviteCode(maxAttempts = 8) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = generateInviteCode();
    const existing = await getDoc(doc(db, 'inviteCodes', code));
    if (!existing.exists()) {
      return code;
    }
  }

  throw new Error('Unable to generate a unique invite code. Please try again.');
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerCaregiver(email: string, password: string, name: string) {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  const inviteCode = await createUniqueInviteCode();
  await setDoc(doc(db, 'caregivers', user.uid, 'profile', 'main'), {
    name,
    email,
    inviteCode,
    createdAt: new Date().toISOString()
  });
  await setDoc(doc(db, 'inviteCodes', inviteCode), { caregiverId: user.uid });
  return { uid: user.uid, inviteCode };
}

export async function registerPatient(email: string, password: string, name: string, inviteCode: string) {
  const normalizedCode = inviteCode.trim().toUpperCase();
  const inviteSnap = await getDoc(doc(db, 'inviteCodes', normalizedCode));
  if (!inviteSnap.exists()) {
    throw new Error('Invalid invite code');
  }
  const { caregiverId } = inviteSnap.data() as { caregiverId?: string };
  if (!caregiverId) {
    throw new Error('Invite code is missing a caregiver link');
  }

  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, 'patients', user.uid), {
    name,
    email,
    linkedCaregiverId: caregiverId,
    createdAt: new Date().toISOString()
  });
  return { uid: user.uid, caregiverId };
}

export async function resolveUserRole(uid: string): Promise<{
  role: 'caregiver' | 'patient';
  caregiverId: string;
}> {
  const caregiverDoc = await getDoc(doc(db, 'caregivers', uid, 'profile', 'main'));
  if (caregiverDoc.exists()) {
    return { role: 'caregiver', caregiverId: uid };
  }

  const patientDoc = await getDoc(doc(db, 'patients', uid));
  if (!patientDoc.exists()) {
    throw new Error('User profile not found');
  }

  const { linkedCaregiverId } = patientDoc.data() as { linkedCaregiverId?: string };
  if (!linkedCaregiverId) {
    throw new Error('Patient profile is missing a linked caregiver');
  }

  return { role: 'patient', caregiverId: linkedCaregiverId };
}

export function caregiverCol(caregiverId: string, colName: string) {
  return collection(db, 'caregivers', caregiverId, colName);
}

export function caregiverDoc(caregiverId: string, colName: string, docId: string) {
  return doc(db, 'caregivers', caregiverId, colName, docId);
}

export function caregiverProfileDoc(caregiverId: string) {
  return doc(db, 'caregivers', caregiverId, 'profile', 'main');
}

async function testConnection() {
  try {
    console.log("Testing Firestore connection...");
    const testDoc = await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful. Document exists:", testDoc.exists());
  } catch (error: any) {
    console.error("Firestore connection test failed:", error.message);
    if (error.message.includes('the client is offline')) {
      console.error("CRITICAL: Firestore client is offline. Please check if the database is provisioned and the configuration is correct.");
    }
    if (error.message.includes('Missing or insufficient permissions')) {
      console.warn("Note: Connection test failed due to permissions. This is expected if the 'test/connection' document is restricted.");
    }
  }
}
testConnection();

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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, query, orderBy, getDoc, where };
