import { supabase } from '$lib/supabaseClient';

export interface UserSessionState {
  user: any | null;
  loading: boolean;
}

export const userSession = $state<UserSessionState>({
  user: null,
  loading: true
});

export function initAuthListener() {
  // Get initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    userSession.user = session?.user ?? null;
    userSession.loading = false;
  });

  // Listen for changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    userSession.user = session?.user ?? null;
    userSession.loading = false;
  });

  return subscription;
}
