import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { compileModule } from 'svelte/compiler';
import { describe, expect, it, vi } from 'vitest';
import { createAttemptSync } from '../../src/lib/attemptSync';
import { attempt } from '../fixtures/attempt';
import type { PendingAttempt } from '../../src/lib/attempts';
const source=ts.transpile(readFileSync(new URL('../../src/lib/syncStore.svelte.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const compiled=compileModule(source,{filename:'syncStore.svelte.js',generate:'client'}).js.code.replace(/import[\s\S]*?from ['"][^'"]+['"];?/g,'').replace('export const syncStore','const syncStore');
function setup(putFailure=false) {
 const user={user:{id:'owner'}};
 const rows=new Map<string,PendingAttempt>();
 const repository={put:vi.fn(async(item:PendingAttempt)=>{if(putFailure)throw Error('quota');rows.set(item.attempt.id,item);}),list:async(owner:string)=>[...rows.values()].filter(item=>item.attempt.user_id===owner),remove:async(id:string)=>{rows.delete(id);}};
 const rpc=vi.fn(async(_name:string,args:any)=>({data:{id:args.p_attempt.id},error:null}));
 const cells={state:(v:unknown)=>({v}),get:(s:any)=>s.v,set:(s:any,v:unknown)=>s.v=v,proxy:(v:unknown)=>v};
 const create=new Function('$','browser','supabase','userSession','createPendingRepository','importLegacyQueue','createAttemptSync','clearLocalSession','localStorage',compiled+';return syncStore;');
 const store=create(cells,true,{rpc},user,()=>repository,async()=>{},createAttemptSync,()=>{},{});
 return {store,user,rows,rpc};
}
describe('durable sync store wiring',()=>{
 it('saves through the narrow RPC with original UUID and generation',async()=>{
  const s=setup(); s.store.configure(async()=>({generation:0,revision:0,status:'active'}),()=>{});
  const snapshot={...attempt('fixed'),generation:0}; await s.store.add(snapshot);
  await vi.waitFor(()=>expect(s.store.stateFor('fixed')).toBe('saved'));
  expect(s.rpc).toHaveBeenCalledWith('save_attempt',{p_attempt:snapshot}); expect(s.rows.size).toBe(0);
 });
 it('does not claim saved when IndexedDB fails',async()=>{
  const s=setup(true); await expect(s.store.add({...attempt('fixed'),generation:0})).rejects.toThrow('quota');
  expect(s.store.stateFor('fixed')).toBe('error'); expect(s.rpc).not.toHaveBeenCalled();
 });
 it('keeps the attempt durable when authoritative state cannot be fetched',async()=>{
  const s=setup();s.store.configure(async()=>null,()=>{});await s.store.add({...attempt('fixed'),generation:0});
  expect(s.rows.size).toBe(1);expect(s.store.stateFor('fixed')).toBe('queued');expect(s.rpc).not.toHaveBeenCalled();
 });
 it('discards a reset generation without sending it or touching another owner',async()=>{
  const s=setup();s.rows.set('other',{attempt:{...attempt('other','other'),generation:0},queued_at:'2026-01-01'});
  s.store.configure(async()=>({generation:1,revision:2,status:'active'}),()=>{});await s.store.add({...attempt('fixed'),generation:0});
  await vi.waitFor(()=>expect(s.store.stateFor('fixed')).toBe('discarded'));
  expect(s.rows.has('other')).toBe(true);expect(s.rpc).not.toHaveBeenCalled();
 });
});

