import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseHarness, seedHarness, fixtureAttempt, ids, rpc } from './databaseHarness';
describe('sealed administrative transactions', () => {
  let h: Awaited<ReturnType<typeof createDatabaseHarness>>;
  beforeAll(async () => { h = await createDatabaseHarness(); await seedHarness(h); },30000);
  afterAll(async () => { await h?.close(); });
  const save = (id: string, extra = {}) => h.asRole('authenticated',ids.a,()=>h.db.query('SELECT public.save_attempt($1::jsonb)',[JSON.stringify(fixtureAttempt(id,ids.a,extra))]));
  const one='10000000-0000-4000-8000-000000000001', two='10000000-0000-4000-8000-000000000002', three='10000000-0000-4000-8000-000000000003';
  it('freezes selection, invalidates new attempts, rejects cross-user and other session', async () => {
    await save(one,{score:0,user_answers:{0:'b'}}); await save(two);
    const selection = await rpc(h,'selection',{userId:ids.a,kind:'matching',filter:{}});
    expect(selection.ids).toEqual([one,two]);
    await save(three);
    await expect(rpc(h,'delete_attempts',{userId:ids.a,selectionId:selection.selectionId,operationId:'20000000-0000-4000-8000-000000000001'})).rejects.toThrow(/SELECTION_STALE/);
    await expect(rpc(h,'selection',{userId:ids.b,kind:'ids',ids:[one]})).rejects.toThrow(/SELECTION_STALE/);
  });
  it('deletes exactly sealed rows, rebuilds chronologically, tombstones retries, idempotent result', async () => {
    const selection=await rpc(h,'selection',{userId:ids.a,kind:'ids',ids:[two,three]});
    const args={userId:ids.a,selectionId:selection.selectionId,operationId:'20000000-0000-4000-8000-000000000002'};
    const result=await rpc(h,'delete_attempts',args);
    expect(result.deletedCount).toBe(2); expect(result.status).toBe('succeeded');
    expect(await rpc(h,'delete_attempts',args)).toEqual(result);
    await expect(rpc(h,'delete_attempts',{...args,userId:ids.b})).rejects.toThrow(/ID_CONFLICT/);
    expect((await h.db.query('SELECT seen_questions,wrong_questions FROM public.user_progress WHERE user_id=$1',[ids.a])).rows[0]).toEqual({seen_questions:['q'],wrong_questions:['q']});
    await expect(save(two)).rejects.toThrow(/ATTEMPT_DELETED/);
  });
  it('reset increments generation and preserves unrelated user byte-for-byte', async () => {
    const before=await h.db.query('SELECT to_jsonb(s) data FROM private.user_data_state s WHERE user_id=$1',[ids.b]);
    const selection=await rpc(h,'selection',{userId:ids.a,kind:'reset'});
    const result=await rpc(h,'reset',{userId:ids.a,selectionId:selection.selectionId,operationId:'20000000-0000-4000-8000-000000000003'});
    expect(result.state.generation).toBe(1);
    await expect(save('10000000-0000-4000-8000-000000000004')).rejects.toThrow(/STALE_GENERATION/);
    expect(await h.db.query('SELECT to_jsonb(s) data FROM private.user_data_state s WHERE user_id=$1',[ids.b])).toEqual(before);
  });
  it('current membership and protected targets are checked at mutation time', async () => {
    await expect(rpc(h,'selection',{userId:ids.admin,kind:'reset'})).rejects.toThrow(/PROTECTED_TARGET/);
    await h.db.query('UPDATE private.admin_memberships SET active=false WHERE user_id=$1',[ids.admin]);
    await expect(rpc(h,'overview')).rejects.toThrow(/FORBIDDEN/);
  });
});
