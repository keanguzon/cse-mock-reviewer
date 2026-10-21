import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rebuildProgress, summarizeAttempts } from '../../src/lib/performance';
import { createDatabaseHarness, fixtureAttempt, ids, rpc, seedHarness } from './databaseHarness';

describe('deterministic rebuild and owner fences',()=>{
  let h:Awaited<ReturnType<typeof createDatabaseHarness>>;
  const one='12000000-0000-4000-8000-000000000001',two='12000000-0000-4000-8000-000000000002',three='12000000-0000-4000-8000-000000000003';
  beforeAll(async()=>{h=await createDatabaseHarness();await seedHarness(h);},30000);
  afterAll(async()=>{await h?.close();});
  const save=(id:string,extra:Record<string,unknown>={})=>h.asRole('authenticated',ids.a,()=>h.db.query('SELECT public.save_attempt($1::jsonb)',[JSON.stringify(fixtureAttempt(id,ids.a,extra))]));
  it('late arrival and tied timestamp order match the pure oracle',async()=>{
    const attempts=[fixtureAttempt(two,ids.a,{score:0,user_answers:{0:'b'}}),fixtureAttempt(one),fixtureAttempt(three,ids.a,{completed_at:'2026-10-20T00:00:00Z',user_answers:{}})];
    for(const a of attempts) await h.asRole('authenticated',ids.a,()=>h.db.query('SELECT public.save_attempt($1::jsonb)',[JSON.stringify(a)]));
    const expected=rebuildProgress(attempts);
    expect((await h.db.query('SELECT seen_questions,wrong_questions FROM public.user_progress WHERE user_id=$1',[ids.a])).rows[0]).toEqual({seen_questions:expected.seen,wrong_questions:expected.wrong});
  });
  it('partial legacy snapshot rebuild discloses missing history and never retains guessed IDs',async()=>{
    await h.db.query(`INSERT INTO public.exam_attempts(id,user_id,score,total,category,mode,completed_at,generation) VALUES('12000000-0000-4000-8000-000000000004',$1,3,4,'Verbal','practice','2026-10-19',0)`,[ids.a]);
    await h.db.query(`UPDATE public.user_progress SET seen_questions=ARRAY['invented'],wrong_questions=ARRAY['invented'] WHERE user_id=$1`,[ids.a]);
    await save('12000000-0000-4000-8000-000000000005');
    const state=await h.asRole('authenticated',ids.a,()=>h.db.query<{s:any}>('SELECT public.reviewer_data_state() s'));
    expect(state.rows[0].s.progressCoverage).toBe('partial');expect(state.rows[0].s.incompleteAttemptCount).toBe(1);
    expect((await h.db.query('SELECT seen_questions,wrong_questions FROM public.user_progress WHERE user_id=$1',[ids.a])).rows[0]).toEqual({seen_questions:['q'],wrong_questions:[]});
  });
  it('admin detail aggregates all history in SQL without returning raw snapshots',async()=>{
    const rows=await h.db.query<any>('SELECT * FROM public.exam_attempts WHERE user_id=$1 ORDER BY completed_at DESC,id',[ids.a]);
    const result=await rpc(h,'user',{userId:ids.a});
    expect(result.performance).toEqual(summarizeAttempts(rows.rows));
    expect(result).not.toHaveProperty('attempts');
  });
  it('rejects oversized, invalid answer, duplicate question and ownership spoofed writes',async()=>{
    const oversized=fixtureAttempt('12000000-0000-4000-8000-000000000006',ids.a,{padding:'x'.repeat(5242880)});
    await expect(h.asRole('authenticated',ids.a,()=>h.db.query('SELECT public.save_attempt($1::jsonb)',[JSON.stringify(oversized)]))).rejects.toThrow(/INVALID_ATTEMPT/);
    await expect(save('12000000-0000-4000-8000-000000000006',{user_answers:{0:'not a choice'}})).rejects.toThrow(/INVALID_ATTEMPT/);
    await expect(save('12000000-0000-4000-8000-000000000006',{user_id:ids.b})).rejects.toThrow(/FORBIDDEN/);
    const q=fixtureAttempt().questions[0];
    await expect(save('12000000-0000-4000-8000-000000000006',{total:2,questions:[q,q]})).rejects.toThrow(/INVALID_ATTEMPT/);
  });
  it('cleans up only the matching paused session, reset fences all stale session writes',async()=>{
    const sessionId='42000000-0000-4000-8000-000000000001';
    const session={sessionId,ownerId:ids.a,generation:0,version:2};
    await h.asRole('authenticated',ids.a,()=>h.db.query('SELECT public.save_active_session($1::jsonb,0)',[JSON.stringify(session)]));
    await save('12000000-0000-4000-8000-000000000006',{active_session_id:'42000000-0000-4000-8000-000000000002'});
    expect((await h.db.query<{n:number}>('SELECT count(*)::int n FROM public.active_sessions')).rows[0].n).toBe(1);
    await save('12000000-0000-4000-8000-000000000007',{active_session_id:sessionId});
    expect((await h.db.query<{n:number}>('SELECT count(*)::int n FROM public.active_sessions')).rows[0].n).toBe(0);
    const selection=await rpc(h,'selection',{userId:ids.a,kind:'reset'});
    await rpc(h,'reset',{userId:ids.a,selectionId:selection.selectionId,operationId:'22000000-0000-4000-8000-000000000001'});
    await expect(h.asRole('authenticated',ids.a,()=>h.db.query('SELECT public.save_active_session($1::jsonb,0)',[JSON.stringify(session)]))).rejects.toThrow(/STALE_GENERATION/);
    expect((await h.db.query('SELECT seen_questions,wrong_questions FROM public.user_progress WHERE user_id=$1',[ids.a])).rows[0]).toEqual({seen_questions:[],wrong_questions:[]});
    expect((await rpc(h,'user',{userId:ids.a})).performance).toEqual(summarizeAttempts([]));
  });
  it('SQL analytics use arithmetic means and specific legacy categories with mixed fallbacks excluded',async()=>{
    await h.db.query(`INSERT INTO public.exam_attempts(id,user_id,score,total,category,mode,completed_at,generation) VALUES
      ('12000000-0000-4000-8000-000000000020',$1,1,1,'Verbal','practice','2026-10-21',0),
      ('12000000-0000-4000-8000-000000000021',$1,0,9,'Mixed Categories','practice','2026-10-21',0)`,[ids.b]);
    const result=await rpc(h,'user',{userId:ids.b});
    expect(result.performance).toEqual({examCount:2,bestPercentage:100,averagePercentage:50,categories:[{category:'Verbal',totalCorrect:1,totalQuestions:1,percentage:100}],incompleteAttemptCount:2});
    await h.db.query(`INSERT INTO public.exam_attempts(id,user_id,score,total,category,mode,completed_at,generation,questions,user_answers) VALUES
      ('12000000-0000-4000-8000-000000000022',$1,0,0,'General / Mixed','practice','2026-10-21',0,NULL,NULL),
      ('12000000-0000-4000-8000-000000000023',$1,1,3,'Mixed Categories','practice','2026-10-21',0,$2::jsonb,'{"0":"a","2":"b"}')`,
      [ids.b,JSON.stringify([{id:'v',category:'Verbal',correct_answer:'a'},{id:'mixed',category:'all',correct_answer:'a'},{id:'n',category:'Numerical',correct_answer:'a'}])]);
    const rows=await h.db.query<any>('SELECT * FROM public.exam_attempts WHERE user_id=$1 ORDER BY completed_at DESC,id',[ids.b]);
    expect((await rpc(h,'user',{userId:ids.b})).performance).toEqual(summarizeAttempts(rows.rows));
  });
});
