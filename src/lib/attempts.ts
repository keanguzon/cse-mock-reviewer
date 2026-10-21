import type { Question } from './questions';

export type SaveState = 'saving' | 'queued' | 'saved' | 'local' | 'error' | 'discarded';
export type ReviewerDataState = { generation: number; revision: number; status: 'active' | 'deleting' | 'deleted'; progressCoverage?: string; incompleteAttemptCount?: number };
export function isTerminalSaveError(error: unknown): boolean {
  const value = error as { code?: string; message?: string } | null;
  return /\b(STALE_GENERATION|ATTEMPT_DELETED|ACCOUNT_DISABLED)\b/.test(`${value?.code ?? ''} ${value?.message ?? ''}`);
}
export type CompletedAttempt = {
  id: string; user_id: string; score: number; total: number;
  category: string; mode: 'practice' | 'mock'; level: 'professional' | 'subprofessional';
  completed_at: string; questions: Question[]; user_answers: Record<number, string>;
  active_session_id?: string;
  generation?: number;
};
export type PendingAttempt = { attempt: CompletedAttempt; queued_at: string };
export interface PendingRepository {
  put(item: PendingAttempt): Promise<void>;
  list(userId: string): Promise<PendingAttempt[]>;
  remove(id: string): Promise<void>;
}

export function isQuestion(value: unknown): value is Question {
  if (!value || typeof value !== 'object') return false;
  const q = value as Record<string, unknown>;
  return ['id', 'category', 'question', 'correct_answer'].every(k => typeof q[k] === 'string' && q[k] !== '') &&
    Array.isArray(q.choices) && q.choices.length === 4 && q.choices.every(c => typeof c === 'string') &&
    new Set(q.choices).size === 4 && typeof q.correct_answer === 'string' && q.choices.includes(q.correct_answer) &&
    (q.explanation === undefined || typeof q.explanation === 'string');
}

export function validAnswers(value: unknown, questions: readonly Question[]): value is Record<number, string> {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.entries(value).every(([index, answer]) => /^(0|[1-9]\d*)$/.test(index) &&
      Number(index) < questions.length && typeof answer === 'string' && questions[Number(index)].choices.includes(answer));
}

export function isCompletedAttempt(value: unknown): value is CompletedAttempt {
  if (!value || typeof value !== 'object') return false;
  const a = value as CompletedAttempt;
  return typeof a.id === 'string' && typeof a.user_id === 'string' && !!a.user_id &&
    (a.generation === undefined || (Number.isSafeInteger(a.generation) && a.generation >= 0)) &&
    Number.isInteger(a.total) && a.total > 0 && a.total <= 2000 &&
    Number.isInteger(a.score) && a.score >= 0 && a.score <= a.total &&
    typeof a.category === 'string' && ['practice', 'mock'].includes(a.mode) &&
    ['professional', 'subprofessional'].includes(a.level) &&
    typeof a.completed_at === 'string' && Number.isFinite(Date.parse(a.completed_at)) &&
    Array.isArray(a.questions) && a.questions.length === a.total && a.questions.every(isQuestion) &&
    new Set(a.questions.map(q => q.id)).size === a.total && validAnswers(a.user_answers, a.questions);
}
