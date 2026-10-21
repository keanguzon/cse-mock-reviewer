import { supabase } from '$lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export interface UserSessionState { user: User | null; loading: boolean }
export const userSession = $state<UserSessionState>({ user: null, loading: true });
const listeners = new Set<() => void>();
export function subscribeUserSession(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function apply(user: User | null) { userSession.user = user; userSession.loading = false; for (const listener of listeners) listener(); }
export function initAuthListener() {
  let live = true;
  let authEvent = 0;
  const initial = authEvent;
  void supabase.auth.getSession().then(({ data: { session } }) => {
    if (live && authEvent === initial) apply(session?.user ?? null);
  });
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    authEvent++;
    if (live) apply(session?.user ?? null);
  });
  return { unsubscribe() { live = false; subscription.unsubscribe(); } };
}
