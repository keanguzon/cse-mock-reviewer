import { describe, expect, it } from 'vitest';
import { allocateQuotas, selectQuestions } from '../../src/lib/questionSelection';
import type { Question } from '../../src/lib/questions';

const make = (id: string, category: string): Question => ({ id, category, question: id, choices: ['a', 'b', 'c', 'd'], correct_answer: 'a' });
const pool = Array.from({ length: 30 }, (_, i) => make(String(i), ['Verbal Ability – Vocabulary', 'Analytical Ability – Logic', 'Numerical Ability – Work', 'General Information – Facts'][i % 4]));
describe('bounded selection', () => {
  it('never makes a negative quota', () => {
    for (let count = 0; count <= 2000; count++) {
      const quotas = allocateQuotas(count, [50, 50, 50, 20]);
      expect(quotas.every(n => Number.isInteger(n) && n >= 0)).toBe(true);
      expect(quotas.reduce((a, b) => a + b, 0)).toBe(count);
    }
  });
  it('returns two rather than 201, and redistributes depleted categories', () => {
    for (let count = 1; count <= 60; count++) {
      const result = selectQuestions(pool, { count, weighted: true, level: 'professional', category: '' }, { seen: [], wrong: [] }, () => 0.5);
      expect(result).toHaveLength(Math.min(count, pool.length));
      expect(new Set(result.map(q => q.id)).size).toBe(result.length);
    }
  });
  it('keeps level/category boundaries and avoids duplicate inconsistent progress IDs', () => {
    const extra = [...pool, make('clerical', 'Clerical Ability – Spelling')];
    const selected = selectQuestions(extra, { count: 2000, weighted: true, level: 'subprofessional', category: '' }, { seen: ['1'], wrong: ['2'] }, () => 0.5);
    expect(selected.some(q => q.category.includes('Analytical'))).toBe(false);
    expect(new Set(selected.map(q => q.id)).size).toBe(selected.length);
    expect(selectQuestions(extra, { count: 20, weighted: true, level: 'professional', category: 'missing' }, { seen: [], wrong: [] })).toEqual([]);
  });
  it('retains unseen then wrong then correct ordering', () => {
    const qs = [make('correct', 'Verbal'), make('wrong', 'Verbal'), make('new', 'Verbal')];
    expect(selectQuestions(qs, { count: 3, weighted: false, level: 'professional', category: '' }, { seen: ['wrong', 'correct'], wrong: ['wrong'] }).map(q => q.id)).toEqual(['new', 'wrong', 'correct']);
  });
});
