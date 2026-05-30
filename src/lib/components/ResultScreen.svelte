<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { userSession } from '$lib/userSession.svelte';

  let { score, total, category, mode, onExit } = $props<{
    score: number;
    total: number;
    category: string;
    mode: string;
    onExit: () => void;
  }>();

  let percentage = $derived(total > 0 ? Math.round((score / total) * 100) : 0);
  
  let gradeClass = $derived.by(() => {
    if (percentage >= 80) return 'text-emerald';
    if (percentage >= 60) return 'text-amber';
    return 'text-red';
  });

  let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function saveAttempt() {
    if (!userSession.user) return;
    try {
      saveStatus = 'saving';
      const { error } = await supabase
        .from('exam_attempts')
        .insert({
          user_id: userSession.user.id,
          score,
          total,
          category,
          mode
        });

      if (error) throw error;
      saveStatus = 'saved';
    } catch (err: any) {
      console.error('Error saving score attempt:', err.message);
      saveStatus = 'error';
    }
  }

  onMount(() => {
    saveAttempt();
  });
</script>


<div class="result-container fade-in">
  <div class="glass-card text-center">
    <span class="eyebrow">Exam Complete</span>
    
    <div class="score-display">
      <span class="score-number {gradeClass}">{percentage}%</span>
    </div>
    
    <p class="summary-text">
      You answered <strong>{score}</strong> out of <strong>{total}</strong> questions correctly.
    </p>

    <div class="stats-bar">
      <div class="stats-labels">
        <span>Correct ({score})</span>
        <span>Incorrect ({total - score})</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill" style="width: {percentage}%"></div>
      </div>
    </div>

    {#if userSession.user}
      <div class="save-indicator slide-up {saveStatus}">
        {#if saveStatus === 'saving'}
          <span class="spinner" aria-busy="true"></span> Saving review progress...
        {:else if saveStatus === 'saved'}
          <span class="icon">📈</span> Progress saved to your account!
        {:else if saveStatus === 'error'}
          <span class="icon">⚠️</span> Couldn't save this attempt.
        {/if}
      </div>
    {:else}
      <div class="save-indicator slide-up promo">
        <span class="icon">💡</span> Sign in to persistently save progress and track analytics!
      </div>
    {/if}

    <button class="btn-primary" onclick={onExit} style="width: 100%; max-width: 400px; padding: 1rem; font-size: 1rem; text-transform: uppercase; letter-spacing: 1px;">
      Return to Dashboard
    </button>
  </div>
</div>

<style>
  .result-container {
    max-width: 600px;
    margin: 3rem auto;
    padding: 0 1rem;
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
    font-family: var(--font-display);
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

  /* ---- Save Indicator ---- */
  .save-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.6rem 1rem;
    border-radius: 999px;
    margin-bottom: 1.5rem;
    border: 1px solid var(--cse-border);
    background: rgba(255, 255, 255, 0.04);
    color: #94a3b8;
    width: 100%;
    max-width: 400px;
  }

  .save-indicator.saved {
    background: rgba(52, 211, 153, 0.08);
    border-color: rgba(52, 211, 153, 0.3);
    color: var(--cse-green);
  }

  .save-indicator.error {
    background: rgba(248, 113, 113, 0.08);
    border-color: rgba(248, 113, 113, 0.3);
    color: var(--cse-red);
  }

  .save-indicator.promo {
    background: rgba(124, 58, 237, 0.08);
    border-color: rgba(124, 58, 237, 0.25);
    color: #a78bfa;
  }

  .save-indicator .spinner {
    width: 1rem;
    height: 1rem;
  }
</style>
