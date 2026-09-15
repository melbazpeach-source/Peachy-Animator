export interface SavedVideo {
  id: string;
  prompt: string;
  aspectRatio: '16:9' | '9:16';
  durationSeconds?: number;
  motionStrength?: number;
  styleFilter?: string;
  videoBlob?: Blob;
  imageBlob?: Blob;
  createdAt: number;
  videoUrl?: string;
  isCloud?: boolean;
}

const DB_NAME = 'PeachyAnimationsDB';
const DB_VERSION = 1;
const STORE_NAME = 'animations';

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function getSavedVideos(): Promise<SavedVideo[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by createdAt descending (newest first)
        const results = request.result as SavedVideo[];
        results.sort((a, b) => b.createdAt - a.createdAt);
        resolve(results);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Error in getSavedVideos:', error);
    return [];
  }
}

export async function saveVideo(entry: Omit<SavedVideo, 'id' | 'createdAt'>): Promise<SavedVideo> {
  const db = await openDB();
  const id = `peachy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const newRecord: SavedVideo = {
    ...entry,
    id,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(newRecord);

    request.onsuccess = () => {
      resolve(newRecord);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function deleteVideo(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
