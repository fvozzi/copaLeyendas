const SESSION_KEY = 'copa-leyendas:match-start-draft';
const DATABASE_NAME = 'copa-leyendas-drafts';
const DATABASE_VERSION = 1;
const STORE_NAME = 'match-start';
const RECORD_KEY = 'active';

export type MatchStartDraft = {
  matchId: number;
  photo: File | null;
};

type StoredMatchStartDraft = {
  key: typeof RECORD_KEY;
  matchId: number;
  photo: Blob | null;
  photoName: string | null;
  photoType: string | null;
};

const session = () => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const database = () => new Promise<IDBDatabase | null>((resolve) => {
  if (typeof indexedDB === 'undefined') {
    resolve(null);
    return;
  }
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => resolve(null);
});

const writeRecord = async (record: StoredMatchStartDraft) => {
  const db = await database();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
  db.close();
};

export async function saveMatchStartDraft(matchId: number, photo: File | null) {
  session()?.setItem(SESSION_KEY, String(matchId));
  await writeRecord({
    key: RECORD_KEY,
    matchId,
    photo,
    photoName: photo?.name ?? null,
    photoType: photo?.type ?? null,
  });
}

export async function loadMatchStartDraft(): Promise<MatchStartDraft | null> {
  const matchId = Number(session()?.getItem(SESSION_KEY));
  if (!Number.isInteger(matchId) || matchId <= 0) return null;
  const db = await database();
  if (!db) return { matchId, photo: null };
  const stored = await new Promise<StoredMatchStartDraft | null>((resolve) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(RECORD_KEY);
    request.onsuccess = () => resolve((request.result as StoredMatchStartDraft | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
  db.close();
  if (!stored || stored.matchId !== matchId || !stored.photo) return { matchId, photo: null };
  return {
    matchId,
    photo: new File([stored.photo], stored.photoName ?? 'foto-partido.jpg', { type: stored.photoType ?? stored.photo.type }),
  };
}

export async function clearMatchStartDraft() {
  session()?.removeItem(SESSION_KEY);
  const db = await database();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(RECORD_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
  db.close();
}
