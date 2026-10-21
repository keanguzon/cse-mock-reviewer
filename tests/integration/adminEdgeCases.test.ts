import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseHarness, fixtureAttempt, ids, rpc, seedHarness } from './databaseHarness';

describe('selection and transaction edge cases',()=>{
  let h:Awaited<ReturnType<typeof createDatabaseHarness>>;
  const one='11000000-0000-4000-8000-000000000001',two='11000000-0000-4000-8000-000000000002',three='11000000-0000-4000-8000-000000000003';
  beforeAll(async()=>{
    h=await createDatabaseHarness();await seedHarness(h);
    for(const [id,extra] of [[one,{category:'Verbal_%',completed_at:'2026-10-20T23:59:59Z'}],[two,{completed_at:'2026-10-21T00:00:00Z'}],[three,{completed_at:'2026-10-21T23:59:59Z'}]] as const){
      await h.asRole('authenticated',ids.a,()=>h.db.query('SELECT public.save_attempt($1::jsonb)',[JSON.stringify(fixtureAttempt(id,ids.a,extra))]));
    }
    await h.asRole('authenticated',ids.b,()=>h.db.query('SELECT public.save_attempt($1::jsonb)',[JSON.stringify(fixtureAttempt('11000000-0000-4000-8000-000000000004',ids.b))]));
  },30000);
  afterAll(async()=>{await h?.close();});
  it('treats wildcard search literally and UTC dates inclusively',async()=>{
    expect((await rpc(h,'attempts',{userId:ids.a,filter:{search:'_%'}})).items.map((a:any)=>a.id)).toEqual([one]);
    expect((await rpc(h,'attempts',{userId:ids.a,filter:{from:'2026-10-21',to:'2026-10-21',category:''}})).items.map((a:any)=>a.id)).toEqual([three,two]);
    await expect(rpc(h,'attempts',{userId:ids.a,filter:{sort:'id; DROP TABLE auth.users'}})).rejects.toThrow(/INVALID_FILTER/);
    await expect(rpc(h,'attempts',{userId:ids.a,filter:{from:'2026-02-30'}})).rejects.toThrow();
    await expect(rpc(h,'attempts',{userId:ids.a,filter:{from:'2026-10-22',to:'2026-10-21'}})).rejects.toThrow(/INVALID_FILTER/);
  });
  it('explicit page selection never expands and excludes only frozen IDs',async()=>{
    const sealed=await rpc(h,'selection',{userId:ids.a,kind:'ids',ids:[one]});expect(sealed.ids).toEqual([one]);
    const matching=await rpc(h,'selection',{userId:ids.a,kind:'matching',filter:{}});expect(matching.count).toBe(3);
    const subset=await rpc(h,'exclude',{userId:ids.a,selectionId:matching.selectionId,ids:[two]});expect(subset.ids).toEqual([one,three]);
    await expect(rpc(h,'exclude',{userId:ids.a,selectionId:matching.selectionId,ids:['11000000-0000-4000-8000-000000000004']})).rejects.toThrow(/SELECTION_STALE/);
    expect((await rpc(h,'selection_get',{userId:ids.a,selectionId:matching.selectionId})).ids).toEqual([one,two,three]);
  });
  it('rejects expired, different-session, and newly protected target previews',async()=>{
    const s=await rpc(h,'selection',{userId:ids.a,kind:'ids',ids:[one]});
    await h.db.query(`INSERT INTO private.admin_sessions SELECT '00000000-0000-4000-8000-000000000099', 'hash2',admin_id,access_token_encrypted,csrf_hash,expires_at,reauthenticated_at,created_at FROM private.admin_sessions WHERE id=$1`,[ids.session]);
    await expect(rpc(h,'selection_get',{userId:ids.a,selectionId:s.selectionId,sessionId:'00000000-0000-4000-8000-000000000099'})).rejects.toThrow(/SELECTION_STALE/);
    await h.db.query(`UPDATE private.admin_selections SET expires_at=now()-interval '1 second' WHERE id=$1`,[s.selectionId]);
    await expect(rpc(h,'selection_get',{userId:ids.a,selectionId:s.selectionId})).rejects.toThrow(/SELECTION_STALE/);
    const protectedSelection=await rpc(h,'selection',{userId:ids.a,kind:'ids',ids:[one]});
    await h.db.query('INSERT INTO private.admin_memberships(user_id) VALUES($1)',[ids.a]);
    await expect(rpc(h,'delete_attempts',{userId:ids.a,selectionId:protectedSelection.selectionId,operationId:'21000000-0000-4000-8000-000000000001'})).rejects.toThrow(/PROTECTED_TARGET/);
    await h.db.query('DELETE FROM private.admin_memberships WHERE user_id=$1',[ids.a]);
  });
  it('active-session revision changes invalidate reset, unrelated session delete does not mutate revision',async()=>{
    const selection=await rpc(h,'selection',{userId:ids.a,kind:'reset'});
    const session={sessionId:'41000000-0000-4000-8000-000000000001',ownerId:ids.a,generation:0,version:2};
    const saved=await h.asRole('authenticated',ids.a,()=>h.db.query<{s:any}>('SELECT public.save_active_session($1::jsonb,0) s',[JSON.stringify(session)]));
    const unchanged=await h.asRole('authenticated',ids.a,()=>h.db.query<{s:any}>(`SELECT public.delete_active_session('41000000-0000-4000-8000-000000000002',0) s`));
    expect(unchanged.rows[0].s).toEqual(saved.rows[0].s);
    await expect(rpc(h,'reset',{userId:ids.a,selectionId:selection.selectionId,operationId:'21000000-0000-4000-8000-000000000002'})).rejects.toThrow(/SELECTION_STALE/);
  });
  it('rebuild failure rolls back attempts, tombstones, selection, operation, state and audit',async()=>{
    const selection=await rpc(h,'selection',{userId:ids.a,kind:'ids',ids:[one]});
    const snapshot=()=>h.db.query(`SELECT jsonb_build_object('attempts',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.exam_attempts t),'state',(SELECT jsonb_agg(to_jsonb(t) ORDER BY user_id) FROM private.user_data_state t),'progress',(SELECT jsonb_agg(to_jsonb(t) ORDER BY user_id) FROM public.user_progress t),'tombstones',(SELECT jsonb_agg(to_jsonb(t)) FROM private.attempt_tombstones t),'audit',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM private.admin_audit t),'operations',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM private.admin_operations t),'selections',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM private.admin_selections t)) value`);
    const before=await snapshot();
    await h.db.exec(`CREATE FUNCTION public.test_fail_rebuild() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rebuild failure';END $$;CREATE TRIGGER test_fail_rebuild BEFORE INSERT OR UPDATE ON public.user_progress FOR EACH ROW EXECUTE FUNCTION public.test_fail_rebuild();`);
    await expect(rpc(h,'delete_attempts',{userId:ids.a,selectionId:selection.selectionId,operationId:'21000000-0000-4000-8000-000000000003'})).rejects.toThrow(/test rebuild failure/);
    await h.db.exec('DROP TRIGGER test_fail_rebuild ON public.user_progress;DROP FUNCTION public.test_fail_rebuild()');
    expect(await snapshot()).toEqual(before);
  });
});
