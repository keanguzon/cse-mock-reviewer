import { isCompletedAttempt, type CompletedAttempt, type PendingAttempt, type PendingRepository } from './attempts';

export function createPendingRepository(factory?: IDBFactory, name = 'cse-reviewer'): PendingRepository {
  let connection: Promise<IDBDatabase> | null = null;
  function open() {
    if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
      const idb = factory ?? globalThis.indexedDB;
      if (!idb) { reject(new Error('Durable storage is unavailable.')); return; }
      const request = idb.open(name, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const pending = db.createObjectStore('pending_attempts', { keyPath: 'attempt.id' });
        pending.createIndex('owner', 'attempt.user_id');
        db.createObjectStore('meta', { keyPath: 'key' });
      };
      request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); connection = null; }; resolve(request.result); };
      request.onerror = () => { connection = null; reject(request.error); };
      request.onblocked = () => { connection = null; reject(new Error('Close other tabs to update local storage.')); };
    });
    return connection;
  }
  async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction('pending_attempts', mode);
      const request = action(tx.objectStore('pending_attempts'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? request.error);
      tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted.'));
    });
  }
  return {
    async put(item) {
      if (!isCompletedAttempt(item.attempt)) throw new Error('Invalid attempt snapshot.');
      await transaction('readwrite', s => s.put(JSON.parse(JSON.stringify(item))));
    },
    async list(userId) {
      const rows = await transaction<PendingAttempt[]>('readonly', s => s.index('owner').getAll(userId));
      return rows.sort((a, b) => a.queued_at.localeCompare(b.queued_at) || a.attempt.id.localeCompare(b.attempt.id));
    },
    async remove(id) { await transaction('readwrite', s => s.delete(id)); }
  };
}

type StorageAccess = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

async function legacyId(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  const hex = Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export async function importLegacyQueue(repository: PendingRepository, storage: StorageAccess): Promise<void> {
  const raw = storage.getItem('cse_pending_attempts');
  if (!raw) return;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }
  if (!Array.isArray(parsed)) {
    storage.setItem('cse_pending_attempts:quarantine', raw);
    return;
  }
  const invalid: unknown[] = [];
  for (const legacy of parsed) {
    if (!legacy || typeof legacy !== 'object') { invalid.push(legacy); continue; }
    const id = await legacyId(legacy);
    const record = { ...legacy, id, completed_at: legacy.completed_at ?? legacy.queued_at } as CompletedAttempt;
    if (!isCompletedAttempt(record)) { invalid.push(legacy); continue; }
    await repository.put({ attempt: record, queued_at: legacy.queued_at });
  }
  if (invalid.length) storage.setItem('cse_pending_attempts:quarantine', JSON.stringify(invalid));
  // Removal happens only after every valid destination write committed.
  storage.removeItem('cse_pending_attempts');
}
