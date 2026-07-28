import { browser } from '$app/environment';

const STORAGE_KEY = 'cse_guest_attempts';

export type GuestAttempt = {
  id: string;
  score: number;
  total: number;
  category: string;
  mode: string;
  level: string;
  completed_at: string;
};

function loadAttempts(): GuestAttempt[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistAttempts(attempts: GuestAttempt[]) {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
  } catch (e) {
    console.error('Error saving guest attempts:', e);
  }
}

let _attempts = $state<GuestAttempt[]>(loadAttempts());

export const guestStore = {
  get attempts() {
    return _attempts;
  },
  save(attempt: Omit<GuestAttempt, 'id' | 'completed_at'>) {
    const entry: GuestAttempt = {
      ...attempt,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      completed_at: new Date().toISOString()
    };
    _attempts = [entry, ..._attempts].slice(0, 20);
    persistAttempts(_attempts);
  },
  clear() {
    _attempts = [];
    if (browser) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
};
