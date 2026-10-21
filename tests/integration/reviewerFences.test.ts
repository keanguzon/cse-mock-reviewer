import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseHarness, seedHarness, ids, fixtureAttempt } from './databaseHarness';
describe('reviewer database fences', () => {
  let h: Awaited<ReturnType<typeof createDatabaseHarness>>;
  beforeAll(async () => { h = await createDatabaseHarness(); await seedHarness(h); }, 30000);
  afterAll(async () => { await h?.close(); });
  const save = (value = fixtureAttempt()) => h.asRole('authenticated', ids.a, async () => (await h.db.query<{ value: any }>('SELECT public.save_attempt($1::jsonb) value', [JSON.stringify(value)])).rows[0].value);
  it('requires explicit generation and valid complete snapshot', async () => {
    await expect(save(fixtureAttempt(undefined, ids.a, { generation: null }))).rejects.toThrow(/STALE_GENERATION/);
    await expect(save(fixtureAttempt(undefined, ids.a, { total: 0 }))).rejects.toThrow(/INVALID_ATTEMPT/);
    await expect(save(fixtureAttempt(undefined, ids.a, { questions: [] }))).rejects.toThrow(/INVALID_ATTEMPT/);
  });
  it('identical UUID retry returns once and conflicting reuse fails', async () => {
    const a = await save(); const b = await save();
    expect(b).toEqual(a);
    await expect(save(fixtureAttempt(undefined, ids.a, { score: 0 }))).rejects.toThrow(/ID_CONFLICT/);
    expect((await h.db.query(`SELECT count(*)::int n FROM public.exam_attempts`)).rows[0]).toEqual({ n: 1 });
  });
  it('revokes direct mutations and exposes only live owner reads', async () => {
    await expect(h.asRole('authenticated', ids.a, () => h.db.exec(`DELETE FROM public.exam_attempts`))).rejects.toThrow(/permission denied/);
    for (const table of ['exam_attempts','user_progress','active_sessions']) {
      for (const privilege of ['INSERT','UPDATE','DELETE']) {
        expect((await h.db.query<{ ok: boolean }>('SELECT has_table_privilege(\'authenticated\',$1,$2) ok',[`public.${table}`,privilege])).rows[0].ok).toBe(false);
      }
    }
    expect((await h.asRole('authenticated', ids.b, () => h.db.query('SELECT * FROM public.exam_attempts'))).rows).toEqual([]);
    expect((await h.asRole('authenticated', ids.a, () => h.db.query('SELECT * FROM public.exam_attempts'))).rows).toHaveLength(1);
    expect((await h.asRole('authenticated', ids.b, () => h.db.query('SELECT * FROM public.profiles WHERE id=\''+ids.a+'\''))).rows).toEqual([]);
    await expect(h.asRole('authenticated',ids.a,()=> h.db.exec(`SELECT public.admin_console('overview','{}')`))).rejects.toThrow(/permission denied/);
  });
  it('stale JWT missing live Auth row cannot read or write', async () => {
    await h.db.query('DELETE FROM auth.users WHERE id=$1',[ids.b]);
    await expect(h.asRole('authenticated',ids.b,()=>h.db.exec('SELECT public.reviewer_data_state()'))).rejects.toThrow(/ACCOUNT_DISABLED/);
  });
});
