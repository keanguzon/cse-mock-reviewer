import type { Question } from './questions';
export const PASSING_PERCENTAGE = 80;
export const STRONG_PERCENTAGE = 90;
export function getPerformanceStatus(percentage: number): 'strong' | 'passing' | 'weak' {
  return percentage >= STRONG_PERCENTAGE ? 'strong' : percentage >= PASSING_PERCENTAGE ? 'passing' : 'weak';
}
export type HistoricalAttempt = { id: string; user_id?: string; score: number; total: number; category: string; mode: string; level?: string | null; completed_at: string; questions?: Question[] | null; user_answers?: Record<number, string> | null };
export type PerformanceSummary = { examCount: number; bestPercentage: number; averagePercentage: number; categories: { category: string; totalCorrect: number; totalQuestions: number; percentage: number }[]; incompleteAttemptCount: number };
const specificCategory = (value: string) => typeof value === 'string' && value.trim() && !['all', 'all categories', 'mixed categories', 'general / mixed'].includes(value.trim().toLowerCase());
function usableQuestion(value: Question | null | undefined): value is Question {
  return !!value && typeof value.id === 'string' && value.id.length > 0 && typeof value.correct_answer === 'string';
}
function completeSnapshot(attempt: HistoricalAttempt): boolean {
  return Array.isArray(attempt.questions) && attempt.questions.length > 0 && attempt.questions.length === attempt.total &&
    attempt.questions.every(usableQuestion) && new Set(attempt.questions.map(q => q.id)).size === attempt.questions.length &&
    !!attempt.user_answers && typeof attempt.user_answers === 'object' && !Array.isArray(attempt.user_answers);
}
export function summarizeAttempts(attempts: readonly HistoricalAttempt[]): PerformanceSummary {
  const percentages = attempts.filter(a => a.total > 0 && Number.isFinite(a.total) && Number.isFinite(a.score) && a.score >= 0 && a.score <= a.total).map(a => a.score / a.total * 100);
  const categories = new Map<string, { correct: number; total: number }>();
  const add = (category: string, correct: number, total: number) => {
    if (!specificCategory(category) || !(total > 0)) return;
    const key = category.trim();
    const previous = categories.get(key) ?? { correct: 0, total: 0 };
    categories.set(key, { correct: previous.correct + correct, total: previous.total + total });
  };
  for (const attempt of attempts) {
    const questions = Array.isArray(attempt.questions) ? attempt.questions.filter(usableQuestion) : [];
    if (questions.length > 0 && attempt.user_answers && typeof attempt.user_answers === 'object') {
      attempt.questions!.forEach((question, index) => {
        if (usableQuestion(question)) add(question.category || '', attempt.user_answers?.[index] === question.correct_answer ? 1 : 0, 1);
      });
    } else if (attempt.score >= 0 && attempt.score <= attempt.total && Number.isFinite(attempt.total)) {
      add(attempt.category || '', attempt.score, attempt.total);
    }
  }
  return {
    examCount: attempts.length,
    bestPercentage: percentages.length ? Math.round(Math.max(...percentages)) : 0,
    averagePercentage: percentages.length ? Math.round(percentages.reduce((sum, pct) => sum + pct, 0) / percentages.length) : 0,
    categories: [...categories].map(([category, value]) => ({ category, totalCorrect: value.correct, totalQuestions: value.total, percentage: Math.round(value.correct / value.total * 100) })).sort((a, b) => b.percentage - a.percentage),
    incompleteAttemptCount: attempts.filter(a => !completeSnapshot(a)).length
  };
}
export function rebuildProgress(attempts: readonly HistoricalAttempt[]): { seen: string[]; wrong: string[]; incompleteAttemptCount: number } {
  const latest = new Map<string, boolean>();
  for (const attempt of [...attempts].sort((a, b) => Date.parse(a.completed_at) - Date.parse(b.completed_at) || a.id.localeCompare(b.id))) {
    if (!Array.isArray(attempt.questions)) continue;
    attempt.questions.forEach((question, index) => {
      if (usableQuestion(question)) latest.set(question.id, attempt.user_answers?.[index] === question.correct_answer);
    });
  }
  return { seen: [...latest.keys()].sort(), wrong: [...latest].filter(([, correct]) => !correct).map(([id]) => id).sort(), incompleteAttemptCount: attempts.filter(a => !completeSnapshot(a)).length };
}
