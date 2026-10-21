import { browser } from '$app/environment';
import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { resolveExamConfig } from '$lib/examConfig';
import { isQuestion } from '$lib/attempts';
import type { PageLoad } from './$types';

// Reviewer credentials live in browser storage, so direct loads must personalize there too.
export const ssr = false;

export const load: PageLoad = async ({ url, fetch }) => {
  let config;
  try { config = resolveExamConfig(Object.fromEntries(url.searchParams)); }
  catch { error(400, 'Unsupported exam configuration.'); }
  const category = url.searchParams.get('category') || '';
  const params = new URLSearchParams({ mode: config.mode, level: config.level, limit: String(config.count), category, profile: config.profile, realistic: String(config.weighted) });
  const headers: Record<string, string> = {};
  if (browser) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) headers.Authorization = `Bearer ${session.access_token}`;
  }
  const res = await fetch(`/api/questions?${params}`, { headers });
  if (!res.ok) error(res.status, 'Could not load questions. Return to the dashboard and retry.');
  const questions: unknown = await res.json();
  if (!Array.isArray(questions) || !questions.every(isQuestion)) error(502, 'Invalid questions response.');
  return { questions, mode: config.mode, category, level: config.level, durationSeconds: config.durationSeconds, profile: config.profile };
};
