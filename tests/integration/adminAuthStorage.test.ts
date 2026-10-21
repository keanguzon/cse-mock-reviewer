import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseHarness,ids,rpc,seedHarness } from './databaseHarness';
describe('private admin auth storage',()=>{
  let h:Awaited<ReturnType<typeof createDatabaseHarness>>;
  beforeAll(async()=>{h=await createDatabaseHarness();await seedHarness(h);},30000);
  afterAll(async()=>{await h?.close();});
  it('membership ignores JWT metadata and follows current live membership',async()=>{
    expect(await rpc(h,'auth_member',{userId:ids.b})).toEqual({active:false,email:null});
    expect(await rpc(h,'auth_member',{userId:ids.admin})).toEqual({active:true,email:'admin@example.test'});
    await h.db.query('UPDATE private.admin_memberships SET active=false WHERE user_id=$1',[ids.admin]);
    expect(await rpc(h,'auth_member',{userId:ids.admin})).toEqual({active:false,email:null});
    await h.db.query('UPDATE private.admin_memberships SET active=true WHERE user_id=$1',[ids.admin]);
    await expect(h.asRole('authenticated',ids.b,()=>h.db.exec(`SELECT public.admin_console('auth_session_get','{"hash":"hash"}')`))).rejects.toThrow(/permission denied/);
  });
  it('atomically admits five checks, rejects the sixth, and expires its window',async()=>{
    const key=`email:${'a'.repeat(64)}`;
    for(let i=0;i<5;i++) expect(await rpc(h,'auth_throttle',{key,failed:false})).toEqual({allowed:true});
    expect(await rpc(h,'auth_throttle',{key,failed:false})).toEqual({allowed:false});
    await rpc(h,'auth_throttle',{key,failed:true});
    expect((await h.db.query('SELECT failures FROM private.admin_throttle WHERE key=$1',[key])).rows[0]).toEqual({failures:5});
    await h.db.query(`UPDATE private.admin_throttle SET window_start=now()-interval '16 minutes' WHERE key=$1`,[key]);
    expect(await rpc(h,'auth_throttle',{key,failed:false})).toEqual({allowed:true});
    await expect(rpc(h,'auth_throttle',{key:'email:raw@example.test',failed:true})).rejects.toThrow(/INVALID_REQUEST/);
  });
  it('rotates opaque session hashes and never extends expiry past one hour',async()=>{
    const put={id:ids.session,adminId:ids.admin,hash:'rotated',accessTokenEncrypted:'cipher2',csrfHash:'csrf2',expiresAt:new Date(Date.now()+3500000).toISOString(),reauthenticatedAt:null};
    await rpc(h,'auth_session_put',put);
    expect(await rpc(h,'auth_session_get',{hash:'hash'})).toBeNull();
    const result=await rpc(h,'auth_session_get',{hash:'rotated'});expect(result.accessTokenEncrypted).toBe('cipher2');expect(result.reauthenticatedAt).toBeNull();
    await expect(rpc(h,'auth_session_put',{...put,expiresAt:new Date(Date.now()+7200000).toISOString()})).rejects.toThrow(/INVALID_SESSION/);
  });
  it('audits only safe structured values and rejects unrecognized actions',async()=>{
    await rpc(h,'auth_audit',{adminId:ids.admin,action:'login_success',status:'succeeded',password:'never persist',email:'never persist'});
    await rpc(h,'failure_audit',{userId:ids.a,action:'selection',error:'sensitive error'});
    const records=await h.db.query('SELECT to_jsonb(a)::text row FROM private.admin_audit a');
    expect(JSON.stringify(records.rows)).not.toContain('never persist');expect(JSON.stringify(records.rows)).not.toContain('sensitive');
    await expect(rpc(h,'auth_audit',{adminId:ids.admin,action:'arbitrary',status:'succeeded'})).rejects.toThrow(/INVALID_REQUEST/);
  });
});
