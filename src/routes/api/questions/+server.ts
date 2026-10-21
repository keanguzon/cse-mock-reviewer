import { json, error, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { allQuestions } from '$lib/questions';
import { resolveExamConfig } from '$lib/examConfig';
import { selectQuestions } from '$lib/questionSelection';
import { createClient } from '@supabase/supabase-js';

export const GET: RequestHandler = async ({ url, request }) => {
  const category = url.searchParams.get('category')?.trim() || '';
  let config;
  try { config = resolveExamConfig(Object.fromEntries(url.searchParams)); }
  catch { error(400, 'Unsupported exam configuration.'); }
  let progress = { seen: [] as string[], wrong: [] as string[] };
  const authorization = request.headers.get('authorization');
  if (authorization && (!env.PUBLIC_SUPABASE_URL || !env.PUBLIC_SUPABASE_ANON_KEY)) error(503, 'Review progress is unavailable. Please retry.');
  if (authorization && env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_ANON_KEY) {
    const client = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const { data, error: authError } = await client.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
    if (authError || !data.user) error(401, 'Please sign in again.');
    const { data: row, error: dbError } = await client.from('user_progress').select('seen_questions,wrong_questions').eq('user_id', data.user.id).maybeSingle();
    if (dbError) error(503, 'Could not load review progress. Please retry.');
    if (row) progress = { seen: row.seen_questions ?? [], wrong: row.wrong_questions ?? [] };
  }
  return json(selectQuestions(allQuestions, { count: config.count, weighted: config.weighted, level: config.level, category }, progress), {
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
};
