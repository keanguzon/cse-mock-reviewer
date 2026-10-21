import type { CompletedAttempt } from '../../src/lib/attempts';

export const attempt = (id: string, user_id = 'owner'): CompletedAttempt => ({
  id, user_id, score: 1, total: 1, category: 'Verbal', mode: 'practice', level: 'professional',
  completed_at: '2026-10-21T00:00:00.000Z',
  questions: [{ id: 'q', category: 'Verbal', question: 'Question', choices: ['a', 'b', 'c', 'd'], correct_answer: 'a' }], user_answers: { 0: 'a' }
});
