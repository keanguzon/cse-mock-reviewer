import { isQuestion, validAnswers } from './attempts';
import type { Question } from './questions';

export type ActiveSession = {
  version: 2; ownerId: string | null; generation: number | null; sessionId: string;
  questions: Question[]; currentIndex: number; userAnswers: Record<number, string>;
  mode: string; category: string; level: string; elapsedSeconds: number; durationSeconds: number;
  pendingAnswer?: string | null; completedAt?: string;
};
type StorageAccess = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export const activeSessionKey = (ownerId: string | null) => ownerId ? `cse_active_session:v2:${ownerId}` : 'cse_guest_active_session:v2';

export function isActiveSession(value: unknown, ownerId: string | null, generation: number | null): value is ActiveSession {
  const s = value as ActiveSession | null;
  return !!s && s.version === 2 && s.ownerId === ownerId && s.generation === generation &&
    typeof s.sessionId === 'string' && !!s.sessionId && Array.isArray(s.questions) && s.questions.length > 0 &&
    s.questions.every(isQuestion) && Number.isInteger(s.currentIndex) && s.currentIndex >= 0 && s.currentIndex <= s.questions.length &&
    validAnswers(s.userAnswers, s.questions) && ['practice', 'mock'].includes(s.mode) &&
    ['professional', 'subprofessional'].includes(s.level) && typeof s.category === 'string' &&
    Number.isFinite(s.elapsedSeconds) && s.elapsedSeconds >= 0 && Number.isFinite(s.durationSeconds) && s.durationSeconds >= 0;
}

export function quarantineLegacySession(storage: StorageAccess) {
  const raw = storage.getItem('cse_active_session');
  if (raw) { storage.setItem('cse_active_session:quarantine', raw); storage.removeItem('cse_active_session'); }
}
export function readLocalSession(storage: StorageAccess, ownerId: string | null, generation: number | null): ActiveSession | null {
  quarantineLegacySession(storage);
  const raw = storage.getItem(activeSessionKey(ownerId));
  if (!raw) return null;
  try { const value: unknown = JSON.parse(raw); return isActiveSession(value, ownerId, generation) ? value : null; }
  catch { return null; }
}
export function storeLocalSession(storage: StorageAccess, session: ActiveSession) {
  if (!isActiveSession(session, session.ownerId, session.generation)) throw new Error('Invalid paused exam snapshot.');
  storage.setItem(activeSessionKey(session.ownerId), JSON.stringify(session));
}
export function clearLocalSession(storage: StorageAccess, ownerId: string | null, sessionId?: string) {
  const key = activeSessionKey(ownerId);
  if (sessionId) {
    const raw = storage.getItem(key);
    try { if (raw && JSON.parse(raw).sessionId !== sessionId) return; } catch { return; }
  }
  storage.removeItem(key);
}

export function upgradeCloudSession(value: unknown, ownerId: string, generation: number): ActiveSession | null {
  if (isActiveSession(value, ownerId, generation)) return value;
  const legacy = value as Partial<ActiveSession> | null;
  if (!legacy || legacy.version !== undefined) return null;
  const upgraded = { ...legacy, version: 2, ownerId, generation, sessionId: crypto.randomUUID(), durationSeconds: legacy.durationSeconds ?? (legacy.mode === 'mock' ? Math.ceil((legacy.questions?.length ?? 20) * 1.12) * 60 : 0), userAnswers: legacy.userAnswers ?? {}, elapsedSeconds: legacy.elapsedSeconds ?? 0 };
  return isActiveSession(upgraded, ownerId, generation) ? upgraded : null;
}
