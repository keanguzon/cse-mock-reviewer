import type { ExamLevel, Question } from './questions';

export function allocateQuotas(limit: number, weights: readonly number[]): number[] {
  if (!Number.isInteger(limit) || limit < 0 || weights.some(w => !Number.isFinite(w) || w < 0)) {
    throw new RangeError('Invalid quota inputs.');
  }
  const total = weights.reduce((a, b) => a + b, 0);
  if (!total) {
    if (limit) throw new RangeError('Positive quota requires a weight.');
    return weights.map(() => 0);
  }
  const exact = weights.map(w => limit * w / total);
  const quotas = exact.map(Math.floor);
  const priority = exact.map((n, i) => ({ i, fraction: n - quotas[i] }))
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
  const remaining = limit - quotas.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remaining; i++) quotas[priority[i].i]++;
  return quotas;
}

export function selectQuestions(
  pool: readonly Question[],
  request: { count: number; weighted: boolean; level: ExamLevel; category: string },
  progress: { seen: readonly string[]; wrong: readonly string[] },
  rng: () => number = Math.random
): Question[] {
  const eligible = [...new Map(pool.filter(q =>
    !(request.level === 'professional' ? q.category.includes('Clerical') : q.category.includes('Analytical')) &&
    (!request.category || q.category === request.category)
  ).map(q => [q.id, q])).values()];
  const target = Math.min(Math.max(0, Math.floor(request.count)), eligible.length);
  const seen = new Set(progress.seen), wrong = new Set(progress.wrong);
  const shuffle = (qs: Question[]) => {
    const out = [...qs];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  const ordered = (qs: Question[]) => [
    ...shuffle(qs.filter(q => !seen.has(q.id) && !wrong.has(q.id))),
    ...shuffle(qs.filter(q => wrong.has(q.id))),
    ...shuffle(qs.filter(q => seen.has(q.id) && !wrong.has(q.id)))
  ];
  if (!request.weighted || request.category) return ordered(eligible).slice(0, target);
  const names = request.level === 'professional'
    ? ['Verbal', 'Analytical', 'Numerical', 'General Information']
    : ['Verbal', 'Clerical', 'Numerical', 'General Information'];
  // Training weights retain the legacy mix; CSC specifies coverage, not these quotas.
  const quotas = allocateQuotas(target, request.level === 'professional' ? [50, 50, 50, 20] : [50, 50, 45, 20]);
  const selected: Question[] = [];
  const picked = new Set<string>();
  const take = (qs: Question[], count: number) => {
    for (const q of ordered(qs).filter(q => !picked.has(q.id)).slice(0, Math.max(0, count))) {
      picked.add(q.id); selected.push(q);
    }
  };
  names.forEach((name, i) => {
    const group = eligible.filter(q => q.category.includes(name));
    const categories = [...new Set(group.map(q => q.category))];
    if (!categories.length) return;
    const start = selected.length;
    const sub = allocateQuotas(quotas[i], categories.map(() => 1));
    categories.forEach((category, j) => take(group.filter(q => q.category === category), sub[j]));
    take(group, quotas[i] - (selected.length - start));
  });
  take(eligible, target - selected.length);
  return selected;
}
