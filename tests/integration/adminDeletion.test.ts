import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseHarness, seedHarness, fixtureAttempt, ids, rpc } from './databaseHarness';
describe('recoverable account deletion',()=>{
  let h:Awaited<ReturnType<typeof createDatabaseHarness>>;
  const operationId='30000000-0000-4000-8000-000000000001';
  beforeAll(async()=>{h=await createDatabaseHarness();await seedHarness(h);await h.asRole('authenticated',ids.a,()=>h.db.query('SELECT public.save_attempt($1::jsonb)',[JSON.stringify(fixtureAttempt())]));},30000);
  afterAll(async()=>{await h?.close();});
  it('rejects stale reauth and wrong email before removing data',async()=>{
    await expect(rpc(h,'delete_prepare',{userId:ids.a,operationId,typedEmail:'wrong@example.test'})).rejects.toThrow(/EMAIL_MISMATCH/);
    await h.db.query(`UPDATE private.admin_sessions SET reauthenticated_at=now()-interval '6 minutes'`);
    await expect(rpc(h,'delete_prepare',{userId:ids.a,operationId,typedEmail:'a@example.test'})).rejects.toThrow(/REAUTH_REQUIRED/);
    await h.db.query(`UPDATE private.admin_sessions SET reauthenticated_at=now()`);
  });
  it('fences reads/writes before Auth deletion and records recoverable failure',async()=>{
    const prepared=await rpc(h,'delete_prepare',{userId:ids.a,operationId,typedEmail:'a@example.test'});
    expect(prepared.status).toBe('app_data_removed'); expect(prepared.state.status).toBe('deleting');
    await expect(h.asRole('authenticated',ids.a,()=>h.db.exec('SELECT public.reviewer_data_state()'))).rejects.toThrow(/ACCOUNT_DISABLED/);
    expect((await h.asRole('authenticated',ids.a,()=>h.db.query('SELECT * FROM public.exam_attempts'))).rows).toEqual([]);
    const claim=await rpc(h,'delete_claim',{operationId});expect(claim.claimed).toBe(true);
    expect((await rpc(h,'delete_claim',{operationId})).claimed).toBe(false);
    const failed=await rpc(h,'delete_finish',{operationId,leaseToken:claim.leaseToken,outcome:'failed',errorCode:'AUTH_DELETE_FAILED'});expect(failed.status).toBe('auth_delete_failed');
  });
  it('retains durable fences and audit after Auth removal and completes idempotently',async()=>{
    const claim=await rpc(h,'delete_claim',{operationId});
    await h.db.query('DELETE FROM auth.users WHERE id=$1',[ids.a]);
    const final=await rpc(h,'delete_finish',{operationId,leaseToken:claim.leaseToken,outcome:'complete'});expect(final.status).toBe('complete');expect(final.state.status).toBe('deleted');
    expect((await rpc(h,'delete_finish',{operationId,outcome:'complete'}))).toEqual(final);
    expect((await h.db.query('SELECT status FROM private.user_data_state WHERE user_id=$1',[ids.a])).rows[0]).toEqual({status:'deleted'});
    expect((await h.db.query<{n:number}>('SELECT count(*)::int n FROM private.admin_audit WHERE operation_id=$1',[operationId])).rows[0].n).toBeGreaterThan(0);
  });
});

describe('deletion lease reconciliation',()=>{
  let h:Awaited<ReturnType<typeof createDatabaseHarness>>;
  const operationId='31000000-0000-4000-8000-000000000001';
  beforeAll(async()=>{h=await createDatabaseHarness();await seedHarness(h);await rpc(h,'delete_prepare',{userId:ids.a,operationId,typedEmail:'a@example.test'});},30000);
  afterAll(async()=>{await h?.close();});
  it('prevents membership provisioning and signup resurrection after preparation',async()=>{
    await expect(h.db.query('INSERT INTO private.admin_memberships(user_id) VALUES($1)',[ids.a])).rejects.toThrow(/ACCOUNT_DISABLED/);
    expect((await h.asRole('authenticated',ids.a,()=>h.db.query('SELECT * FROM public.profiles'))).rows).toEqual([]);
  });
  it('rejects stale lease workers and cannot finalize while Auth still exists',async()=>{
    const first=await rpc(h,'delete_claim',{operationId});
    await h.db.query(`UPDATE private.admin_operations SET lease_until=now()-interval '1 second' WHERE id=$1`,[operationId]);
    const second=await rpc(h,'delete_claim',{operationId});expect(second.leaseToken).not.toBe(first.leaseToken);
    await expect(rpc(h,'delete_finish',{operationId,leaseToken:first.leaseToken,outcome:'failed'})).rejects.toThrow(/LEASE_CONFLICT/);
    await expect(rpc(h,'delete_finish',{operationId,leaseToken:second.leaseToken,outcome:'complete'})).rejects.toThrow(/AUTH_STILL_EXISTS/);
    const pending=await rpc(h,'delete_finish',{operationId,leaseToken:second.leaseToken,outcome:'pending',errorCode:'contains unsafe user details'});expect(pending.status).toBe('auth_delete_pending');
    expect((await h.db.query('SELECT error_code FROM private.admin_operations WHERE id=$1',[operationId])).rows[0]).toEqual({error_code:'AUTH_DELETE_FAILED'});
  });
  it('rechecks membership on finish and preserves operation for a later retry',async()=>{
    const claim=await rpc(h,'delete_claim',{operationId});
    await h.db.query('UPDATE private.admin_memberships SET active=false WHERE user_id=$1',[ids.admin]);
    await expect(rpc(h,'delete_finish',{operationId,leaseToken:claim.leaseToken,outcome:'failed'})).rejects.toThrow(/FORBIDDEN/);
    await h.db.query('UPDATE private.admin_memberships SET active=true WHERE user_id=$1',[ids.admin]);
    await h.db.query(`UPDATE private.admin_operations SET lease_until=now()-interval '1 second' WHERE id=$1`,[operationId]);
    const next=await rpc(h,'delete_claim',{operationId});
    await h.db.query('DELETE FROM auth.users WHERE id=$1',[ids.a]);
    await rpc(h,'delete_finish',{operationId,leaseToken:next.leaseToken,outcome:'complete'});
    await expect(h.db.query(`INSERT INTO auth.users(id,email) VALUES($1,'resurrected@example.test')`,[ids.a])).rejects.toThrow(/ACCOUNT_DISABLED/);
  });
});
