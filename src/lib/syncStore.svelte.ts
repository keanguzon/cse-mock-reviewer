import { browser } from '$app/environment';
import { supabase } from '$lib/supabaseClient';
import { userSession } from '$lib/userSession.svelte';
import { createPendingRepository, importLegacyQueue } from './pendingAttempts';
import { createAttemptSync } from './attemptSync';
import type { CompletedAttempt, PendingAttempt, ReviewerDataState, SaveState } from './attempts';
import { clearLocalSession } from './activeSession';

const repository = createPendingRepository();
let pending = $state<PendingAttempt[]>([]);
let syncing = $state(false);
let statuses = $state<Record<string, SaveState>>({});
let syncError = $state<string | null>(null);
let validate: (() => Promise<ReviewerDataState | null>) | null = null;
let changed: (() => void) | null = null;
const coordinator = createAttemptSync({
  repository,
  getUserId: () => userSession.user?.id ?? null,
  onState(id, state) { statuses = { ...statuses, [id]: state }; if (state === 'saved' || state === 'discarded') changed?.(); },
  async send(attempt) {
    if (userSession.user?.id !== attempt.user_id) throw Error('Account changed.');
    const { data, error } = await supabase.rpc('save_attempt', { p_attempt: attempt });
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883') syncError = 'Database update required. Your attempt remains queued.';
      throw error;
    }
    if (!data || data.id !== attempt.id) throw Error('Unexpected saved attempt identity.');
    if (userSession.user?.id === attempt.user_id && attempt.active_session_id) clearLocalSession(localStorage, attempt.user_id, attempt.active_session_id);
    return data.id as string;
  }
});
async function reload(owner: string) {
  const rows = await repository.list(owner);
  if (userSession.user?.id === owner) pending = rows;
}
export const syncStore = {
  get pending() { return pending; },
  get isSyncing() { return syncing; },
  get error() { return syncError; },
  stateFor(id: string): SaveState | undefined { return statuses[id]; },
  configure(check: typeof validate, onChange: typeof changed) { validate = check; changed = onChange; },
  resetView() { pending = []; statuses = {}; syncError = null; },
  async discardStale(owner: string, generation: number | null) {
    for (const item of await repository.list(owner)) {
      if (generation === null || (item.attempt.generation ?? 0) !== generation) {
        await repository.remove(item.attempt.id);
        if (userSession.user?.id === owner) statuses = { ...statuses, [item.attempt.id]: 'discarded' };
      }
    }
    await reload(owner);
  },
  async add(attempt: CompletedAttempt) {
    if (userSession.user?.id !== attempt.user_id || attempt.generation === undefined) throw Error('A verified exam owner and generation are required.');
    await coordinator.enqueue({ attempt, queued_at: attempt.completed_at });
    await reload(attempt.user_id);
    void this.syncPending();
  },
  async retry(id: string) { if (statuses[id] !== 'discarded') await this.syncPending(); },
  async syncPending() {
    if (!browser || syncing || !validate) return;
    const owner = userSession.user?.id;
    if (!owner) return;
    syncing = true;
    try {
      const state = await validate();
      if (!state || state.status !== 'active' || userSession.user?.id !== owner) return;
      await importLegacyQueue(repository, localStorage, { ownerId: owner, generation: state.generation });
      await this.discardStale(owner, state.generation);
      // Existing durable legacy rows are upgraded only after authoritative generation zero.
      for (const item of await repository.list(owner)) {
        if (item.attempt.generation === undefined && state.generation === 0) await repository.put({ ...item, attempt: { ...item.attempt, generation: 0 } });
      }
      if (userSession.user?.id === owner) await coordinator.drain();
      await reload(owner);
    } catch (error) { syncError = error instanceof Error ? error.message : 'Could not sync queued attempts.'; }
    finally { syncing = false; if (userSession.user?.id && userSession.user.id !== owner) void this.syncPending(); }
  }
};
