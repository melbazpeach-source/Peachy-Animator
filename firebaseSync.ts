import { auth, db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDocFromServer,
  query, 
  where, 
  deleteDoc
} from 'firebase/firestore';

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Mandatory connection test on boots
export async function testConnection() {
  try {
    const testDocPath = 'test/connection';
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration: Client is offline.");
    }
  }
}

// Sync animation metadata to cloud Firestore
export async function syncToFirestore(
  animation: {
    id: string;
    prompt: string;
    aspectRatio: '16:9' | '9:16';
    durationSeconds?: number;
    motionStrength?: number;
    styleFilter?: string;
    createdAt: number;
  },
  userId: string,
  videoUrlStr?: string
): Promise<void> {
  const path = `animations/${animation.id}`;
  try {
    await setDoc(doc(db, 'animations', animation.id), {
      id: animation.id,
      prompt: animation.prompt,
      aspectRatio: animation.aspectRatio,
      durationSeconds: animation.durationSeconds || 5,
      motionStrength: animation.motionStrength || 5,
      styleFilter: animation.styleFilter || 'none',
      videoUrl: videoUrlStr || '',
      createdAt: animation.createdAt,
      userId: userId
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Load animations for the current user from cloud Firestore
export async function getCloudAnimations(userId: string): Promise<any[]> {
  const path = 'animations';
  try {
    const q = query(collection(db, 'animations'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const results: any[] = [];
    querySnapshot.forEach((docSnap) => {
      results.push(docSnap.data());
    });
    // Sort descending by order of createdAt
    results.sort((a, b) => b.createdAt - a.createdAt);
    return results;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

// Delete from Firestore
export async function deleteFromFirestore(animationId: string, userId: string): Promise<void> {
  const path = `animations/${animationId}`;
  try {
    await deleteDoc(doc(db, 'animations', animationId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
