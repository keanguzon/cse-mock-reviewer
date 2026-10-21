import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { createPendingRepository, importLegacyQueue } from '../../src/lib/pendingAttempts';
import { attempt } from '../fixtures/attempt';

describe('IndexedDB attempt repository', () => {
  it('preserves separate writes from two tabs and deletes only an acknowledged ID', async () => {
    const factory = new IDBFactory();
    const a = createPendingRepository(factory, 'test'), b = createPendingRepository(factory, 'test');
    await Promise.all([a.put({ attempt: attempt('a'), queued_at: '2026-01-01' }), b.put({ attempt: attempt('b'), queued_at: '2026-01-02' })]);
    await a.remove('a'); expect((await b.list('owner')).map(p => p.attempt.id)).toEqual(['b']);
    expect(await b.list('other')).toEqual([]);
  });
  it('imports legacy records once with stable IDs and keeps the original timestamp', async () => {
    const factory = new IDBFactory(); const repo = createPendingRepository(factory, 'migration');
    const legacy = { ...attempt('ignored'), queued_at: '2026-10-20T00:00:00.000Z' } as Record<string, unknown>;
    delete legacy.id; delete legacy.completed_at;
    const values = new Map([['cse_pending_attempts', JSON.stringify([legacy])]]);
    const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
    const raw = values.get('cse_pending_attempts')!;
    await importLegacyQueue(repo, storage); values.set('cse_pending_attempts', raw); await importLegacyQueue(repo, storage);
    const rows = await repo.list('owner'); expect(rows).toHaveLength(1);
    expect(rows[0].attempt.id).toMatch(/^[a-f0-9-]{36}$/); expect(rows[0].attempt.completed_at).toBe(legacy.queued_at);
    expect(values.has('cse_pending_attempts')).toBe(false);
  });
});
