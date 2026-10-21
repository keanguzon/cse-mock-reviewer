import { describe, expect, it } from 'vitest';
import { resolveExamConfig } from '../../src/lib/examConfig';

describe('exam configuration', () => {
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
