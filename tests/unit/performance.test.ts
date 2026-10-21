import { describe, expect, it } from 'vitest';
import { rebuildProgress, summarizeAttempts, type HistoricalAttempt } from '../../src/lib/performance';

const row = (overrides: Partial<HistoricalAttempt> = {}): HistoricalAttempt => ({
  id: 'a', user_id: 'owner', score: 1, total: 1, category: 'Verbal', mode: 'practice',
  completed_at: '2026-10-21T00:00:00Z', questions: [{ id: 'q', category: 'Verbal', question: '?', choices: ['a','b','c','d'], correct_answer: 'a' }], user_answers: { 0: 'a' }, ...overrides
});
describe('historical performance', () => {
  it('uses_arithmetic_mean_not_weighted', () => {
    const result = summarizeAttempts([row({ score: 1, total: 1 }), row({ score: 0, total: 9 })]);
    expect(result.averagePercentage).toBe(50);
    expect(result.bestPercentage).toBe(100);
  });
  it('deleting_latest_correct_reveals_earlier_wrong', () => {
    const wrong = row({ id: 'a', user_answers: { 0: 'b' } });
    expect(rebuildProgress([wrong, row({ id: 'b' })]).wrong).toEqual([]);
    expect(rebuildProgress([wrong]).wrong).toEqual(['q']);
  });
  it('unanswered_is_wrong', () => expect(rebuildProgress([row({ user_answers: {} })]).wrong).toEqual(['q']));
  it('ties_use_uuid', () => expect(rebuildProgress([row({ id: 'b', user_answers: { 0: 'b' } }), row({ id: 'a' })]).wrong).toEqual(['q']));
  it('missing_snapshot_reports_partial', () => {
    expect(rebuildProgress([row({ questions: null })])).toEqual({ seen: [], wrong: [], incompleteAttemptCount: 1 });
    expect(summarizeAttempts([row({ questions: null })]).incompleteAttemptCount).toBe(1);
  });
  it('empty_and_zero_total_have_no_nan', () => {
    expect(summarizeAttempts([])).toEqual({ examCount: 0, bestPercentage: 0, averagePercentage: 0, categories: [], incompleteAttemptCount: 0 });
    expect(summarizeAttempts([row({ total: 0, score: 0, questions: null })]).averagePercentage).toBe(0);
  });
  it('specific_legacy_category_fallback_excludes_mixed', () => {
    expect(summarizeAttempts([row({ questions: null, score: 3, total: 4 }), row({ questions: null, category: 'Mixed Categories' })]).categories)
      .toEqual([{ category: 'Verbal', totalCorrect: 3, totalQuestions: 4, percentage: 75 }]);
  });
  it('malformed legacy categories do not break the remaining valid snapshots', () => {
    const malformed=row({questions:[{...row().questions![0],category:{invalid:true}} as any]});
    expect(summarizeAttempts([malformed,row()]).categories).toEqual([{category:'Verbal',totalCorrect:1,totalQuestions:1,percentage:100}]);
  });
});
