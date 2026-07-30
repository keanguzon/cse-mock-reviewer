<script lang="ts">
  import { Trophy, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-svelte';

  type Question = {
    id: string;
    question: string;
    choices: string[];
    correct_answer: string;
    explanation?: string;
    category: string;
  };

  type CategoryResult = {
    category: string;
    correct: number;
    total: number;
    percentage: number;
    status: 'strong' | 'passing' | 'weak';
  };

  let {
    score,
    total,
    questions = [],
    userAnswers = {},
    elapsedTime = 0,
    title = 'Exam Complete',
    showSaveStatus = false,
    saveStatus = 'idle',
    onRetrySave
  } = $props<{
    score: number;
    total: number;
    questions?: Question[];
    userAnswers?: Record<number, string>;
    elapsedTime?: number;
    title?: string;
    showSaveStatus?: boolean;
    saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
    onRetrySave?: () => void;
  }>();

  let percentage = $derived(total > 0 ? Math.round((score / total) * 100) : 0);

  let formattedElapsed = $derived.by(() => {
    if (!elapsedTime) return '';
    const mins = Math.floor(elapsedTime / 60);
    const secs = elapsedTime % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hrs}h ${remainMins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  });

  let gradeClass = $derived.by(() => {
    if (percentage >= 80) return 'text-emerald';
    if (percentage >= 60) return 'text-amber';
    return 'text-red';
  });

  let categoryBreakdown = $derived.by(() => {
    if (!questions || questions.length === 0) return [];
    const map = new Map<string, { correct: number; total: number }>();
    questions.forEach((q: Question, idx: number) => {
      const cat = q.category || 'General';
      if (!map.has(cat)) map.set(cat, { correct: 0, total: 0 });
      const entry = map.get(cat)!;
      entry.total++;
      if (userAnswers[idx] === q.correct_answer) entry.correct++;
    });
    const results: CategoryResult[] = [];
    map.forEach((val, cat) => {
      const pct = Math.round((val.correct / val.total) * 100);
      results.push({
        category: cat,
        correct: val.correct,
        total: val.total,
        percentage: pct,
        status: pct >= 90 ? 'strong' : pct >= 80 ? 'passing' : 'weak',
      });
    });
    results.sort((a, b) => b.percentage - a.percentage);
    return results;
  });

  let strongAreas = $derived(categoryBreakdown.filter(c => c.status === 'strong'));
  let weakAreas = $derived(categoryBreakdown.filter(c => c.status === 'weak'));
</script>

<div class="analytics-card-content text-center">
  <div class="result-header-decor" style="display: flex; justify-content: center; margin-bottom: 0.5rem; gap: 0.5rem; color: #a78bfa;">
    {#if percentage >= 80}
      <Sparkles size={32} class="text-emerald" style="filter: drop-shadow(0 0 8px rgba(52,211,153,0.3));" />
      <Trophy size={32} class="text-emerald" style="filter: drop-shadow(0 0 8px rgba(52,211,153,0.3));" />
      <Sparkles size={32} class="text-emerald" style="filter: drop-shadow(0 0 8px rgba(52,211,153,0.3));" />
    {:else}
      <Trophy size={32} style="filter: drop-shadow(0 0 8px rgba(167,139,250,0.3));" />
    {/if}
  </div>
  
  <span class="eyebrow">{title}</span>

  <div class="score-display">
    <span class="score-number {gradeClass}">{percentage}%</span>
  </div>

  <p class="summary-text">
    You answered <strong>{score}</strong> out of <strong>{total}</strong> questions correctly.
    {#if formattedElapsed}
      <br><span style="font-size: 0.85rem; color: #7c6d8e; margin-top: 0.25rem; display: inline-block;">Time Taken: <strong style="color: white;">{formattedElapsed}</strong></span>
    {/if}
  </p>

  <div class="benchmark-indicator">
    <span class="benchmark-text {percentage >= 80 ? 'above' : 'below'}">
      {percentage >= 80 ? '✓ Above' : '✗ Below'} CSE Passing Benchmark (80%)
    </span>
  </div>

  <div class="stats-bar">
    <div class="stats-labels">
      <span>Correct ({score})</span>
      <span>Incorrect ({total - score})</span>
    </div>
    <div class="bar-bg">
      <div class="bar-fill" style="width: {percentage}%"></div>
    </div>
  </div>

  {#if categoryBreakdown.length > 1}
    <div class="category-breakdown slide-up">
      <h3 class="breakdown-title">Performance by Category</h3>

      <div style="display: flex; justify-content: center; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
        {#if strongAreas.length > 0}
          <div class="area-label area-strong">
            <span class="area-dot strong-dot"></span>
            Strong Areas ({strongAreas.length})
          </div>
        {/if}
        {#if weakAreas.length > 0}
          <div class="area-label area-weak">
            <span class="area-dot weak-dot"></span>
            Needs Practice ({weakAreas.length})
          </div>
        {/if}
      </div>

      <div class="breakdown-list">
        {#each categoryBreakdown as cat}
          <div class="breakdown-item">
            <div class="breakdown-info">
              <span class="breakdown-cat">{cat.category}</span>
              <span class="breakdown-score {cat.status}">{cat.correct}/{cat.total} ({cat.percentage}%)</span>
            </div>
            <div class="breakdown-bar-bg">
              <div
                class="breakdown-bar-fill {cat.status}"
                style="width: {cat.percentage}%"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if showSaveStatus}
    <div class="save-indicator slide-up {saveStatus}" style="display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 1.5rem;">
      {#if saveStatus === 'saving'}
        <span class="spinner" aria-busy="true"></span> Saving review progress...
      {:else if saveStatus === 'saved'}
        <CheckCircle2 size={16} class="text-emerald" /> Progress saved to your account!
      {:else if saveStatus === 'error'}
        <AlertTriangle size={16} class="text-red" /> Couldn't save this attempt.
        {#if onRetrySave}
          <button class="btn-ghost" onclick={onRetrySave} style="padding: 0.2rem 0.6rem; font-size: 0.75rem; border-color: rgba(248, 113, 113, 0.4); color: var(--cse-red); margin-left: 0.5rem; display: inline-flex; align-items: center; gap: 0.25rem;">
            🔄 Retry
          </button>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .analytics-card-content {
    width: 100%;
  }

  .text-center {
    text-align: center;
  }

  .eyebrow {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #7c6d8e;
    display: block;
    margin-bottom: 1rem;
  }

  .score-display {
    margin-bottom: 1.5rem;
  }

  .score-number {
    font-size: 5rem;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -2px;
    font-family: var(--font-body);
    font-variant-numeric: tabular-nums lining-nums;
  }

  .text-emerald { color: var(--cse-green); }
  .text-amber { color: var(--cse-orange); }
  .text-red { color: var(--cse-red); }

  .summary-text {
    font-size: 1.1rem;
    color: #94a3b8;
    margin-bottom: 2rem;
  }

  .summary-text strong {
    color: var(--cse-text);
  }

  .stats-bar {
    max-width: 400px;
    margin: 0 auto 2rem;
  }

  .stats-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.72rem;
    font-weight: 700;
    color: #7c6d8e;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .bar-bg {
    width: 100%;
    height: 10px;
    background: rgba(248, 113, 113, 0.2);
    border-radius: 999px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--cse-green), #6ee7b7);
    border-radius: 999px;
    transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .benchmark-indicator {
    margin-bottom: 1.5rem;
  }

  .benchmark-text {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 0.35rem 0.85rem;
    border-radius: 999px;
    display: inline-block;
  }

  .benchmark-text.above {
    background: rgba(52, 211, 153, 0.12);
    color: var(--cse-green);
    border: 1px solid rgba(52, 211, 153, 0.3);
  }

  .benchmark-text.below {
    background: rgba(248, 113, 113, 0.12);
    color: var(--cse-red);
    border: 1px solid rgba(248, 113, 113, 0.3);
  }

  /* ---- Category Breakdown ---- */
  .category-breakdown {
    max-width: 480px;
    margin: 0 auto 2rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1.25rem;
  }

  .breakdown-title {
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #94a3b8;
    margin-bottom: 0.75rem;
    text-align: center;
  }

  .area-label {
    font-size: 0.75rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.6rem;
    border-radius: 6px;
  }

  .area-strong {
    background: rgba(52, 211, 153, 0.1);
    color: #6ee7b7;
  }

  .area-weak {
    background: rgba(248, 113, 113, 0.1);
    color: #fca5a5;
  }

  .area-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .strong-dot { background: var(--cse-green); }
  .weak-dot { background: var(--cse-red); }

  .breakdown-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .breakdown-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .breakdown-info {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
  }

  .breakdown-cat {
    color: #e2e8f0;
    font-weight: 500;
    text-align: left;
  }

  .breakdown-score {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .breakdown-score.strong { color: #6ee7b7; }
  .breakdown-score.passing { color: var(--cse-green); }
  .breakdown-score.weak { color: #fca5a5; }

  .breakdown-bar-bg {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 999px;
    overflow: hidden;
  }

  .breakdown-bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .breakdown-bar-fill.strong {
    background: linear-gradient(90deg, #34d399, #6ee7b7);
  }

  .breakdown-bar-fill.passing {
    background: linear-gradient(90deg, #10b981, #34d399);
  }

  .breakdown-bar-fill.weak {
    background: linear-gradient(90deg, #ef4444, #f87171);
  }

  .save-indicator {
    font-size: 0.85rem;
    font-weight: 500;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.5rem 1rem;
    border-radius: 999px;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: var(--cse-purple-light);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
