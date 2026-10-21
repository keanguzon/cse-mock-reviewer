import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { compileModule } from 'svelte/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as sessions from '../../src/lib/activeSession';
const source = ts.transpile(readFileSync(new URL('../../src/lib/reviewerData.svelte.ts', import.meta.url), 'utf8'), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
const compiled = compileModule(source, { filename: 'reviewerData.svelte.js', generate: 'client' }).js.code.replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '').replace('export const reviewerData', 'const reviewerData');
function setup(rpc: ReturnType<typeof vi.fn>, row: unknown = null) {
 const storage = new Map<string,string>();
 vi.stubGlobal('localStorage', { getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k) });
 const user = { user: { id:'a' }, loading:false };
 const sync = { resetView:vi.fn(), discardStale:vi.fn(async()=>{}) };
 const supabase = { rpc, auth:{ signOut:vi.fn(async()=>{}) }, from:()=>({ select:()=>({ eq:()=>({ maybeSingle:async()=>({data:row,error:null}) }) }) }) };
 // Compile the actual rune module; these cells isolate store logic from component rendering.
 const cells = { state:(v:unknown)=>({v}), get:(s:any)=>s.v, set:(s:any,v:unknown)=>s.v=v, update:(s:any)=>s.v++ };
 const create = new Function('$','browser','supabase','userSession','subscribeUserSession','syncStore',...Object.keys(sessions), compiled+'; return reviewerData;');
 const store = create(cells,true,supabase,user,()=>()=>{},sync,...Object.values(sessions));
 return {store,user,sync,supabase,storage};
}
afterEach(()=>vi.unstubAllGlobals());
const active = (generation=0,revision=0)=>({generation,revision,status:'active'});
describe('authoritative reviewer invalidation',()=>{
 it('ignores an earlier account response after an account switch',async()=>{
  let release!: (v:unknown)=>void;
  const rpc=vi.fn().mockImplementationOnce(()=>new Promise(r=>release=r)).mockResolvedValue({data:active(2,4),error:null});
  const s=setup(rpc); const old=s.store.refresh(); s.user.user={id:'b'};
  await s.store.refresh(); release({data:active(8,99),error:null}); await old;
  expect(s.store.ownerId).toBe('b'); expect(s.store.state).toEqual(active(2,4));
 });
 it('removes only reset owner local and queued state',async()=>{
  const rpc=vi.fn().mockResolvedValueOnce({data:active(),error:null}).mockResolvedValueOnce({data:active(1,2),error:null});
  const s=setup(rpc); await s.store.refresh(); s.storage.set('cse_active_session:v2:a','{}'); s.storage.set('cse_active_session:v2:b','untouched');
  await s.store.refresh(); expect(s.sync.discardStale).toHaveBeenCalledWith('a',1); expect(s.storage.has('cse_active_session:v2:a')).toBe(false); expect(s.storage.get('cse_active_session:v2:b')).toBe('untouched');
 });
 it('does not restore authenticated local data without authoritative state',async()=>{
  const s=setup(vi.fn().mockResolvedValue({data:null,error:{code:'PGRST202',message:'missing'}}));
  expect(await s.store.loadActiveSession()).toBeNull(); expect(s.store.error).toContain('Database update required');
 });
 it('upgrades owner-protected cloud legacy sessions before allowing resume/delete',async()=>{
  const question={id:'q',category:'Verbal',question:'Q',choices:['a','b','c','d'],correct_answer:'a'};
  const legacy={questions:[question],currentIndex:0,userAnswers:{},mode:'practice',category:'Verbal',level:'professional',elapsedSeconds:0};
  const rpc=vi.fn().mockResolvedValue({data:active(),error:null}); const s=setup(rpc,{generation:0,session_data:legacy});
  const restored=await s.store.loadActiveSession(); expect(restored?.version).toBe(2);
  expect(rpc).toHaveBeenCalledWith('save_active_session',{p_session:restored,p_generation:0});
 });
});
