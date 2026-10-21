import { browser } from '$app/environment';
import { untrack } from 'svelte';
import { supabase } from './supabaseClient';
import { userSession, subscribeUserSession } from './userSession.svelte';
import { syncStore } from './syncStore.svelte';
import { clearLocalSession, quarantineLegacySession, readLocalSession, storeLocalSession, upgradeCloudSession, type ActiveSession } from './activeSession';
import type { ReviewerDataState } from './attempts';

let ownerId = $state<string | null>(null);
let state = $state<ReviewerDataState | null>(null);
let change = $state(0);
let error = $state<string | null>(null);
let epoch = 0;
let pending: { owner: string; epoch: number; promise: Promise<ReviewerDataState | null> } | null = null;
let channel: BroadcastChannel | null = null;
const listeners = new Set<() => void>();
function notify() { change++; for (const listener of listeners) listener(); }
function switchOwner() {
  const next = userSession.user?.id ?? null;
  if (next !== ownerId) { epoch++; ownerId = next; state = null; error = null; syncStore.resetView(); notify(); }
}
async function refresh(): Promise<ReviewerDataState | null> {
  if (!browser) return null;
  switchOwner();
  const owner = ownerId, requestEpoch = epoch;
  if (!owner || userSession.loading) return null;
  if (pending?.owner === owner && pending.epoch === requestEpoch) return pending.promise;
  const promise = (async () => {
    try {
      const { data, error: rpcError } = await supabase.rpc('reviewer_data_state');
      if (ownerId !== owner || epoch !== requestEpoch || userSession.user?.id !== owner) return null;
      if (rpcError) {
        if (rpcError.message?.includes('ACCOUNT_DISABLED')) {
          await syncStore.discardStale(owner, null);
          if (userSession.user?.id !== owner) return null;
          clearLocalSession(localStorage, owner); state = null; error = 'This account is no longer available.'; notify();
          channel?.postMessage({ owner });
          await supabase.auth.signOut({ scope: 'local' });
        } else error = rpcError.code === 'PGRST202' || rpcError.code === '42883' ? 'Database update required before account progress can sync.' : 'Could not verify account progress. Reconnect to try again.';
        return null;
      }
      if (!data || !Number.isSafeInteger(data.generation) || !Number.isSafeInteger(data.revision) || !['active', 'deleting', 'deleted'].includes(data.status)) throw Error('Invalid progress state.');
      const next = data as ReviewerDataState;
      if (state && (next.generation < state.generation || next.revision < state.revision)) return state;
      const previous = state;
      state = next; error = null;
      if (next.status !== 'active' || (previous && previous.generation !== next.generation)) {
        clearLocalSession(localStorage, owner);
        await syncStore.discardStale(owner, next.status === 'active' ? next.generation : null);
        if (userSession.user?.id !== owner || epoch !== requestEpoch) return null;
      } else {
        const local = localStorage.getItem(`cse_active_session:v2:${owner}`);
        if (local && !readLocalSession(localStorage, owner, next.generation)) clearLocalSession(localStorage, owner);
      }
      if (!previous || previous.generation !== next.generation || previous.revision !== next.revision || previous.status !== next.status) {
        notify(); channel?.postMessage({ owner });
      }
      if (next.status !== 'active' && userSession.user?.id === owner) await supabase.auth.signOut({ scope: 'local' });
      return next;
    } catch { if (ownerId === owner && epoch === requestEpoch) error = 'Could not verify account progress. Reconnect to try again.'; return null; }
    finally { if (pending?.owner === owner && pending.epoch === requestEpoch) pending = null; }
  })();
  pending = { owner, epoch: requestEpoch, promise };
  return promise;
}
export const reviewerData = {
  get ownerId() { return ownerId; }, get state() { return state; }, get change() { return change; }, get error() { return error; },
  refresh,
  async loadActiveSession(): Promise<ActiveSession | null> {
    const owner = userSession.user?.id ?? null;
    if (!owner) return readLocalSession(localStorage, null, null);
    const verified = await refresh();
    if (!verified || verified.status !== 'active' || userSession.user?.id !== owner) return null;
    const { data, error: dbError } = await supabase.from('active_sessions').select('session_data,generation').eq('user_id', owner).maybeSingle();
    if (userSession.user?.id !== owner || state?.generation !== verified.generation) return null;
    const local = readLocalSession(localStorage, owner, verified.generation);
    if (dbError) return local;
    const cloud = data?.generation === verified.generation ? upgradeCloudSession(data.session_data, owner, data.generation) : null;
    if (cloud && data?.session_data?.version === undefined) {
      const { error: upgradeError } = await supabase.rpc('save_active_session', { p_session: cloud, p_generation: verified.generation });
      if (upgradeError || userSession.user?.id !== owner || state?.generation !== verified.generation) return local;
      storeLocalSession(localStorage, cloud);
      void refresh();
    }
    // A completed local snapshot retains the same UUID through a lost save response.
    return local && (local.completedAt || (cloud?.sessionId === local.sessionId && local.elapsedSeconds >= cloud.elapsedSeconds)) ? local : cloud ?? local;
  },
  async saveActiveSession(session: ActiveSession) {
    if (session.ownerId !== (userSession.user?.id ?? null)) throw Error('Account changed.');
    storeLocalSession(localStorage, session);
    if (!session.ownerId) return;
    const verified = await refresh();
    if (!verified) throw Error(error ?? 'Could not verify account progress.');
    if (verified.generation !== session.generation || verified.status !== 'active') throw Error('STALE_GENERATION');
    if (userSession.user?.id !== session.ownerId) throw Error('Account changed.');
    const { error: rpcError } = await supabase.rpc('save_active_session', { p_session: session, p_generation: session.generation });
    if (rpcError) throw rpcError;
    void refresh();
  },
  async deleteActiveSession(session: ActiveSession) {
    if (session.ownerId !== (userSession.user?.id ?? null)) throw Error('Account changed.');
    if (session.ownerId) {
      const verified = await refresh();
      if (!verified) throw Error(error ?? 'Could not verify account progress.');
      if (verified.generation === session.generation && verified.status === 'active') {
        if (userSession.user?.id !== session.ownerId) throw Error('Account changed.');
        const { error: rpcError } = await supabase.rpc('delete_active_session', { p_session_id: session.sessionId, p_generation: session.generation });
        if (rpcError) throw rpcError;
      }
    }
    clearLocalSession(localStorage, session.ownerId, session.sessionId);
    void refresh();
  },
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  start() {
    if (!browser) return () => {};
    quarantineLegacySession(localStorage);
    syncStore.configure(refresh, () => { void refresh(); });
    const update = () => { switchOwner(); if (!userSession.loading && ownerId) void refresh().then(() => syncStore.syncPending()); };
    const stopAuth = subscribeUserSession(update);
    if (typeof BroadcastChannel !== 'undefined') { channel = new BroadcastChannel('cse-reviewer-data'); channel.onmessage = event => { if (event.data?.owner === userSession.user?.id) update(); }; }
    window.addEventListener('focus', update); window.addEventListener('online', update); window.addEventListener('pageshow', update);
    document.addEventListener('visibilitychange', update);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') update(); }, 60_000);
    untrack(update);
    return () => { stopAuth(); clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('online', update); window.removeEventListener('pageshow', update); document.removeEventListener('visibilitychange', update); channel?.close(); channel = null; syncStore.configure(null, null); };
  }
};
