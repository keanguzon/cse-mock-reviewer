import { describe, expect, it } from 'vitest';
import { createAttemptSync } from '../../src/lib/attemptSync';
import type { CompletedAttempt, PendingAttempt, SaveState } from '../../src/lib/attempts';

import { attempt } from '../fixtures/attempt';
const pending = (id: string, owner = 'owner'): PendingAttempt => ({ attempt: attempt(id, owner), queued_at: '2026-10-21T00:00:00.000Z' });
function setup(send: (a: CompletedAttempt) => Promise<string>) {
  const rows = new Map<string, PendingAttempt>();
  let owner: string | null = null;
  const states = new Map<string, SaveState>();
  const repository = { put: async (p: PendingAttempt) => { rows.set(p.attempt.id, p); }, list: async (userId: string) => [...rows.values()].filter(p => p.attempt.user_id === userId), remove: async (id: string) => { rows.delete(id); } };
  const sync = createAttemptSync({ repository, send, getUserId: () => owner, onState: (id, state) => { states.set(id, state); } });
  return { sync, rows, states, repository, setOwner: (v: string | null) => { owner = v; } };
}
describe('durable attempt coordinator', () => {
  it('preserves adds during a running drain', async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => release = r);
    const sent: string[] = [];
    const s = setup(async a => { sent.push(a.id); if (a.id === 'a') await gate; return a.id; });
    await s.sync.enqueue(pending('a')); s.setOwner('owner');
    const draining = s.sync.drain();
    await Promise.resolve(); await s.sync.enqueue(pending('b'));
    release(); await draining; await s.sync.drain();
    expect(sent).toEqual(['a', 'b']); expect(s.rows.size).toBe(0);
  });
  it('keeps failures durable and reuses ID/timestamp on retry', async () => {
    let fail = true; const sent: CompletedAttempt[] = [];
    const s = setup(async a => { sent.push(a); if (fail) throw Error('lost response'); return a.id; });
    await s.sync.enqueue(pending('same')); s.setOwner('owner'); await s.sync.drain();
    expect(s.rows.size).toBe(1); expect(s.states.get('same')).toBe('queued');
    fail = false; await s.sync.retry('same');
    expect(sent[0]).toEqual(sent[1]); expect(s.rows.size).toBe(0); expect(s.states.get('same')).toBe('saved');
  });
  it('only sends current owner and suppresses stale account statuses', async () => {
    const s = setup(async a => { s.setOwner('other'); return a.id; });
    await s.sync.enqueue(pending('a')); await s.sync.enqueue(pending('b', 'other'));
    s.setOwner('owner'); await s.sync.drain();
    expect(s.rows.has('b')).toBe(true); expect(s.states.get('a')).not.toBe('saved');
  });
  it('never claims queued or saved when durable put fails', async () => {
    const s = setup(async a => a.id); s.repository.put = async () => { throw Error('quota'); };
    await expect(s.sync.enqueue(pending('a'))).rejects.toThrow('quota');
    expect(s.states.get('a')).toBe('error');
  });
});
