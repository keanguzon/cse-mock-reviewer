import type { ExamLevel } from './questions';

export type ExamProfile = 'official' | 'extended' | 'custom';
export type ExamConfig = {
  mode: 'practice' | 'mock'; level: ExamLevel; profile: ExamProfile;
  count: number; durationSeconds: number; weighted: boolean;
};
export type ExamInput = {
  mode?: string; level?: string; category?: string; limit?: string;
  profile?: string; realistic?: string;
};

export class ExamValidationError extends Error {}

export function resolveExamConfig(input: ExamInput): ExamConfig {
  const mode = input.mode || 'practice';
  const level = input.level || 'professional';
  if (!['practice', 'mock'].includes(mode) || !['professional', 'subprofessional'].includes(level)) {
    throw new ExamValidationError('Unsupported exam mode or level.');
  }
  if (input.profile && !['official', 'extended', 'custom'].includes(input.profile)) {
    throw new ExamValidationError('Unsupported exam profile.');
  }
  const parsed = Number.parseInt(input.limit || '20', 10);
  const count = Math.min(2000, Math.max(1, Number.isFinite(parsed) ? parsed || 20 : 20));
  const official = input.profile === 'official';
  if (official && (mode !== 'mock' || input.category?.trim() ||
      input.limit !== (level === 'professional' ? '150' : '145'))) {
    throw new ExamValidationError('Official-format mocks require the matching level, full count, and mixed categories.');
  }
  const extended = !official && mode === 'mock' && !input.category?.trim() &&
    count === (level === 'professional' ? 170 : 165);
  return {
    mode: mode as ExamConfig['mode'], level: level as ExamLevel,
    profile: official ? 'official' : extended ? 'extended' : 'custom', count,
    durationSeconds: mode === 'practice' ? 0 : official
      ? (level === 'professional' ? 190 : 160) * 60 : Math.ceil(count * 1.12) * 60,
    weighted: !input.category?.trim() && (official || input.realistic === 'true')
  };
}
