import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
export const ids = { admin: '00000000-0000-4000-8000-000000000001', a: '00000000-0000-4000-8000-000000000002', b: '00000000-0000-4000-8000-000000000003', session: '00000000-0000-4000-8000-000000000004' };
export async function createDatabaseHarness(options: { manual?: boolean; upgrade?: boolean; beforeUpgrade?: (db: PGlite) => Promise<void> } = {}) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, created_at timestamptz DEFAULT now(), raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO PUBLIC;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon,authenticated,service_role;`);
  if (options.manual) {
    for (const path of ['schema.sql', 'supabase_migration.sql', 'supabase_migration_active_session.sql']) await db.exec(await readFile(path, 'utf8'));
  }
  await db.exec(await readFile('supabase/migrations/20260730_reviewer_baseline.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20260731_create_user_progress.sql', 'utf8'));
  await options.beforeUpgrade?.(db);
  if (options.upgrade !== false) await db.exec(await readFile('supabase/migrations/20261021_admin_console.sql', 'utf8'));
  const asRole = async <T>(role: 'anon' | 'authenticated' | 'service_role', userId: string | null, callback: () => Promise<T>): Promise<T> => {
    await db.exec(`SET ROLE ${role}`);
    await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claims',$2,false)`, [userId ?? '', JSON.stringify({ role, sub: userId })]);
    try { return await callback(); }
    finally { await db.exec('RESET ROLE'); }
  };
  return { db, asRole, close: () => db.close() };
}
export async function seedHarness(h: Awaited<ReturnType<typeof createDatabaseHarness>>) {
  await h.db.query(`INSERT INTO auth.users(id,email) VALUES ($1,'admin@example.test'),($2,'a@example.test'),($3,'b@example.test')`, [ids.admin, ids.a, ids.b]);
  await h.db.query(`INSERT INTO private.admin_memberships(user_id) VALUES ($1)`, [ids.admin]);
  await h.db.query(`INSERT INTO private.admin_sessions(id,session_hash,admin_id,access_token_encrypted,csrf_hash,expires_at,reauthenticated_at) VALUES ($1,'hash',$2,'cipher','csrf',now()+interval '1 hour',now())`, [ids.session, ids.admin]);
}
export function fixtureAttempt(id = '10000000-0000-4000-8000-000000000001', owner = ids.a, extra: Record<string, unknown> = {}) {
  return { id, user_id: owner, generation: 0, score: 1, total: 1, category: 'Verbal', mode: 'practice', level: 'professional', completed_at: '2026-10-21T00:00:00Z', questions: [{ id: 'q', category: 'Verbal', question: '?', choices: ['a', 'b', 'c', 'd'], correct_answer: 'a' }], user_answers: { 0: 'a' }, ...extra };
}
export async function rpc(h: Awaited<ReturnType<typeof createDatabaseHarness>>, action: string, args: Record<string, unknown> = {}) {
  return h.asRole('service_role', null, async () => (await h.db.query<{ value: any }>(`SELECT public.admin_console($1,$2::jsonb) AS value`, [action, JSON.stringify({ actorId: ids.admin, sessionId: ids.session, ...args })])).rows[0].value);
}
