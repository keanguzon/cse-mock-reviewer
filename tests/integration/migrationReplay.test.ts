import { describe, expect, it } from 'vitest';
import { createDatabaseHarness, ids } from './databaseHarness';

describe('migration replay',()=>{
  for (const manual of [false,true]) it(`preserves ${manual ? 'manually initialized' : 'fresh baseline'} rows and removes permissive policies`,async()=>{
    const h=await createDatabaseHarness({manual,beforeUpgrade:async db=>{
      await db.query(`INSERT INTO auth.users(id,email) VALUES($1,'legacy@example.test')`,[ids.a]);
      await db.query(`INSERT INTO public.exam_attempts(id,user_id,score,total,category,mode) VALUES('10000000-0000-4000-8000-000000000001',$1,3,4,'Verbal','practice')`,[ids.a]);
      await db.exec(`INSERT INTO public.questions(category,question,choices,correct_answer) VALUES('Verbal','Original question','["a","b","c","d"]','a');
        GRANT ALL ON public.exam_attempts,public.user_progress,public.active_sessions TO PUBLIC;
        GRANT ALL ON public.profiles TO anon,authenticated;
        GRANT INSERT(score),UPDATE(score) ON public.exam_attempts TO authenticated;`);
    }});
    try{
      expect((await h.db.query('SELECT score,total,generation FROM public.exam_attempts')).rows).toEqual([{score:3,total:4,generation:0}]);
      expect((await h.db.query('SELECT question FROM public.questions')).rows).toEqual([{question:'Original question'}]);
      expect((await h.db.query('SELECT progress_coverage,incomplete_attempt_count FROM private.user_data_state WHERE user_id=$1',[ids.a])).rows[0]).toEqual({progress_coverage:'partial',incomplete_attempt_count:1});
      const policies=await h.db.query<{tablename:string;cmd:string;qual:string;with_check:string}>('SELECT tablename,cmd,qual,with_check FROM pg_policies WHERE schemaname=\'public\' AND tablename<>\'questions\'');
      expect(policies.rows).toHaveLength(5);
      expect(policies.rows.every(p=>['SELECT','UPDATE'].includes(p.cmd)&&p.qual.includes('live_user'))).toBe(true);
      expect(policies.rows.find(p=>p.cmd==='UPDATE')?.with_check).toContain('live_user');
      for (const table of ['exam_attempts','active_sessions','user_progress']) for (const privilege of ['INSERT','UPDATE','DELETE']) {
        expect((await h.db.query<{ok:boolean}>('SELECT has_table_privilege(\'authenticated\',$1,$2) ok',[`public.${table}`,privilege])).rows[0].ok).toBe(false);
      }
      expect((await h.db.query<{ok:boolean}>('SELECT has_schema_privilege(\'authenticated\',\'private\',\'USAGE\') ok')).rows[0].ok).toBe(false);
      expect((await h.db.query<{ok:boolean}>(`SELECT has_column_privilege('authenticated','public.exam_attempts','score','INSERT') ok`)).rows[0].ok).toBe(false);
      expect((await h.db.query<{ok:boolean}>(`SELECT has_column_privilege('authenticated','public.exam_attempts','score','UPDATE') ok`)).rows[0].ok).toBe(false);
      expect((await h.db.query('SELECT column_default FROM information_schema.columns WHERE table_name IN (\'exam_attempts\',\'active_sessions\') AND column_name=\'generation\'')).rows).toEqual([{column_default:null},{column_default:null}]);
    }finally{await h.close();}
  },30000);
});
