import { describe, expect, it } from 'vitest';
import { allocateQuotas, selectQuestions, shuffleQuestionChoices } from '../../src/lib/questionSelection';
import type { Question } from '../../src/lib/questions';
import comprehension from '../../src/lib/questions/verbal_pagaunawa_filipino.json';

const make = (id: string, category: string): Question => ({ id, category, question: id, choices: ['a', 'b', 'c', 'd'], correct_answer: 'a' });
const pool = Array.from({ length: 30 }, (_, i) => make(String(i), ['Verbal Ability – Vocabulary', 'Analytical Ability – Logic', 'Numerical Ability – Work', 'General Information – Facts'][i % 4]));
describe('bounded selection', () => {
  it('breaks the Filipino comprehension always-B strategy on served questions', () => {
    let seed = 97531;
    const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const served = selectQuestions(comprehension, { count: 50, weighted: false, level: 'professional', category: '' }, { seen: [], wrong: [] }, rng);
    const positions = [0, 0, 0, 0];
    for (const question of served) {
      positions[question.choices.indexOf(question.correct_answer)]++;
      expect(question.correct_answer).toBe(comprehension.find(q => q.id === question.id)!.correct_answer);
    }
    expect(positions.every(count => count > 0)).toBe(true);
    expect(Math.max(...positions)).toBeLessThan(30);
  });
  it('moves a keyed B choice without changing the answer or source bank', () => {
    const q = { ...make('q', 'Verbal'), choices: ['first', 'correct', 'third', 'fourth'], correct_answer: 'correct' };
    const original = JSON.stringify(q);
    const shuffled = shuffleQuestionChoices(q, () => 0);
    expect(shuffled.choices.indexOf(shuffled.correct_answer)).toBe(0);
    expect(shuffled.correct_answer).toBe(q.correct_answer);
    expect([...shuffled.choices].sort()).toEqual([...q.choices].sort());
    expect(JSON.stringify(q)).toBe(original);
  });
  it('permits all four answer positions across attempts and retains a resumable snapshot', () => {
    let seed = 12345;
    const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const positions = new Set<number>();
    const q = make('q', 'Verbal');
    for (let i = 0; i < 100; i++) {
      const shuffled = shuffleQuestionChoices(q, rng);
      positions.add(shuffled.choices.indexOf(q.correct_answer));
      expect(JSON.parse(JSON.stringify(shuffled)).choices).toEqual(shuffled.choices);
    }
    expect([...positions].sort()).toEqual([0, 1, 2, 3]);
  });
  it.each([
    { choices: ['first', 'second', 'third', 'All of the above'] },
    { explanation: 'Choice B is the correct answer.' },
    { question: 'Piliin ang sagot: A o B.' },
    { choices: ['A. first', 'B. second', 'C. third', 'D. fourth'] }
  ])('preserves position-dependent wording instead of invalidating it', patch => {
    const q = { ...make('q', 'Verbal'), ...patch };
    expect(shuffleQuestionChoices(q, () => 0).choices).toEqual(q.choices);
  });
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
