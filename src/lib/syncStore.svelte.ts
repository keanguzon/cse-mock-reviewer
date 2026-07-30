import { browser } from '$app/environment';
import { supabase } from '$lib/supabaseClient';

const STORAGE_KEY = 'cse_pending_attempts';

export type PendingAttemptPayload = {
  user_id: string;
  score: number;
  total: number;
  category: string;
  mode: string;
  level: string;
  questions: any;
  user_answers: any;
  queued_at: string;
};

function loadPending(): PendingAttemptPayload[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePending(list: PendingAttemptPayload[]) {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to persist pending attempts queue:', err);
  }
}

let _pending = $state<PendingAttemptPayload[]>(loadPending());
let _isSyncing = $state<boolean>(false);

export const syncStore = {
  get pending() {
    return _pending;
  },
  get isSyncing() {
    return _isSyncing;
  },
  add(attempt: Omit<PendingAttemptPayload, 'queued_at'>) {
    const item: PendingAttemptPayload = {
      ...attempt,
      queued_at: new Date().toISOString()
    };
    _pending = [..._pending, item];
    savePending(_pending);
    this.syncPending();
  },
  async syncPending() {
    if (!browser || _pending.length === 0 || _isSyncing) return;

    _isSyncing = true;
    const remaining: PendingAttemptPayload[] = [];

    for (const item of _pending) {
      try {
        const { error } = await supabase
          .from('exam_attempts')
          .insert({
            user_id: item.user_id,
            score: item.score,
            total: item.total,
            category: item.category,
            mode: item.mode,
            level: item.level,
            questions: item.questions,
            user_answers: item.user_answers
          });

        if (error) {
          console.error('Failed sync item, keeping in queue:', error.message);
          remaining.push(item);
        }
      } catch (err) {
        console.error('Network error during sync, keeping in queue:', err);
        remaining.push(item);
      }
    }

    _pending = remaining;
    savePending(_pending);
    _isSyncing = false;
  }
};

if (browser) {
  window.addEventListener('online', () => {
    syncStore.syncPending();
  });
}
