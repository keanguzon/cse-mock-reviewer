import { describe, expect, it } from 'vitest';
import { resolveExamConfig, getExamOptions, quizUrl } from '../../src/lib/examConfig';

describe('exam configuration', () => {
  it('offers official counts in mixed categories and retains extended counts', () => {
    expect(getExamOptions('professional', '', 1750).map(o => o.value)).toEqual(['10','20','50','150','170','1750']);
    expect(getExamOptions('subprofessional', '', 1450).map(o => o.value)).toContain('145');
    expect(getExamOptions('professional', 'Verbal', 100).map(o => o.value)).not.toContain('150');
    expect(quizUrl({mode:'practice',level:'professional',category:'',limit:'150'})).toContain('mode=mock');
    expect(quizUrl({mode:'practice',level:'professional',category:'',limit:'150'})).toContain('profile=official');
    expect(quizUrl({mode:'mock',level:'professional',category:'',limit:'170'})).toContain('realistic=true');
  });
  it.each([
    ['professional', '150', 'official', 'true', 11400],
    ['subprofessional', '145', 'official', 'true', 9600],
    ['professional', '170', undefined, 'true', 11460],
    ['subprofessional', '165', undefined, 'true', 11100]
  ])('preserves %s %s timing', (level, limit, profile, realistic, seconds) => {
    expect(resolveExamConfig({ mode: 'mock', level, limit, profile, realistic, category: '' }).durationSeconds).toBe(seconds);
  });
  it('keeps practice untimed and default count 20', () => {
    expect(resolveExamConfig({})).toMatchObject({ mode: 'practice', count: 20, durationSeconds: 0, profile: 'custom' });
  });
  it('rejects invalid explicit official combinations', () => {
    for (const input of [{ mode: 'practice' }, { limit: '170' }, { category: 'Verbal' }, { level: 'bogus' }]) {
      expect(() => resolveExamConfig({ mode: 'mock', level: 'professional', limit: '150', category: '', profile: 'official', ...input })).toThrow();
    }
  });
  it('bounds custom limits without misclassifying old URLs', () => {
    expect(resolveExamConfig({ limit: '-5' }).count).toBe(1);
    expect(resolveExamConfig({ limit: '9999' }).count).toBe(2000);
    expect(resolveExamConfig({ mode: 'mock', limit: '150' }).durationSeconds).toBe(10140);
  });
});
