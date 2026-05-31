<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { userSession } from '$lib/userSession.svelte';

  type Question = {
    id: string;
    question: string;
    choices: string[];
    correct_answer: string;
    explanation?: string;
    category: string;
  };

  let { score, total, category, mode, level = 'professional', questions = [], userAnswers = {}, onExit } = $props<{
    score: number;
    total: number;
    category: string;
    mode: string;
    level?: string;
    questions?: Question[];
    userAnswers?: Record<number, string>;
    onExit: () => void;
  }>();

  let percentage = $derived(total > 0 ? Math.round((score / total) * 100) : 0);
  
  let gradeClass = $derived.by(() => {
    if (percentage >= 80) return 'text-emerald';
    if (percentage >= 60) return 'text-amber';
    return 'text-red';
  });

  let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
  let isReviewMode = $state(false);

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
          mode,
          level,
          questions: questions,
          user_answers: userAnswers
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
  {#if !isReviewMode}
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

      {#if questions && questions.length > 0}
        <button class="btn-primary" onclick={() => isReviewMode = true} style="width: 100%; max-width: 400px; padding: 1rem; font-size: 1rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1rem;">
          Review Answers
        </button>
      {/if}

      <button class="btn-ghost" onclick={onExit} style="width: 100%; max-width: 400px; padding: 1rem; font-size: 1rem; text-transform: uppercase; letter-spacing: 1px;">
        Return to Dashboard
      </button>
    </div>
  {:else}
    <!-- Review Mode UI -->
    <div class="review-card slide-up">
      <header class="review-header">
        <button class="btn-back" onclick={() => isReviewMode = false}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Back to Score
        </button>
        <div class="review-meta">
          <h2>Exam Review</h2>
          <span class="category-badge">{category}</span>
        </div>
      </header>

      <div class="questions-list">
        {#each questions as question, index}
          {@const userAnswer = userAnswers[index]}
          {@const isCorrect = userAnswer === question.correct_answer}
          
          <div class="review-item glass-card {isCorrect ? 'item-correct' : userAnswer ? 'item-wrong' : 'item-unanswered'}">
            <header class="review-item-header">
              <span class="question-number">Question {index + 1} of {total}</span>
              <span class="status-badge {isCorrect ? 'status-correct' : userAnswer ? 'status-wrong' : 'status-unanswered'}">
                {#if isCorrect}
                  ✓ Correct
                {:else if userAnswer}
                  ✗ Incorrect
                {:else}
                  ⚠ Unanswered
                {/if}
              </span>
            </header>

            <h3 class="q-text">{@html question.question.replace(/_+/g, '<span class="blank-line"></span>')}</h3>

            <div class="choices-grid">
              {#each question.choices as choice, i}
                {@const isChoiceSelected = userAnswer === choice}
                {@const isChoiceCorrect = choice === question.correct_answer}
                
                <div class="choice-display {isChoiceCorrect ? 'choice-correct' : isChoiceSelected ? 'choice-wrong' : 'choice-disabled'}">
                  <span class="choice-letter">{String.fromCharCode(65 + i)}</span>
                  <span class="choice-text">{choice}</span>
                  
                  {#if isChoiceCorrect}
                    <span class="choice-status correct-status">Correct Answer</span>
                  {:else if isChoiceSelected}
                    <span class="choice-status wrong-status">Your Answer</span>
                  {/if}
                </div>
              {/each}
            </div>

            {#if question.explanation}
              <div class="explanation">
                <strong>Explanation:</strong>
                <p>{question.explanation}</p>
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <footer class="review-footer">
        <button class="btn-primary" onclick={onExit} style="width: 100%; max-width: 400px; padding: 1rem; font-size: 1rem; text-transform: uppercase; letter-spacing: 1px;">
          Return to Dashboard
        </button>
      </footer>
    </div>
  {/if}
</div>

<style>
  .result-container {
    max-width: 600px;
    margin: 3rem auto;
    padding: 0 1rem;
  }

  .result-container:has(.review-card) {
    max-width: 800px;
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

  /* ---- Review Card ---- */
  .review-card {
    text-align: left;
    margin-top: 1rem;
  }

  .review-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--cse-border);
    padding-bottom: 1.5rem;
    margin-bottom: 2rem;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--cse-text);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: var(--cse-transition);
  }

  .btn-back:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateX(-2px);
  }

  .review-meta h2 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 800;
    margin: 0;
    text-align: right;
  }

  .category-badge {
    display: inline-block;
    background: rgba(124, 58, 237, 0.15);
    color: var(--cse-primary-light);
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 1px solid rgba(124, 58, 237, 0.3);
    margin-top: 0.25rem;
  }

  .questions-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 3rem;
  }

  .review-item {
    border-left: 5px solid transparent;
    transition: var(--cse-transition);
  }

  .review-item.item-correct {
    border-left-color: var(--cse-green);
    background: rgba(52, 211, 153, 0.02);
  }

  .review-item.item-wrong {
    border-left-color: var(--cse-red);
    background: rgba(248, 113, 113, 0.02);
  }

  .review-item.item-unanswered {
    border-left-color: var(--cse-text-muted);
    background: rgba(255, 255, 255, 0.01);
  }

  .review-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .question-number {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--cse-text-muted);
  }

  .status-badge {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .status-correct {
    background: rgba(52, 211, 153, 0.15);
    color: var(--cse-green);
  }

  .status-wrong {
    background: rgba(248, 113, 113, 0.15);
    color: var(--cse-red);
  }

  .status-unanswered {
    background: rgba(255, 255, 255, 0.08);
    color: var(--cse-text-muted);
  }

  .q-text {
    font-size: 1.15rem;
    font-weight: 600;
    line-height: 1.5;
    margin-bottom: 1.5rem;
    color: white;
  }

  .choices-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .choice-display {
    display: flex;
    align-items: center;
    border: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    overflow: hidden;
    font-size: 0.9rem;
  }

  .choice-letter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    align-self: stretch;
    background: rgba(255, 255, 255, 0.04);
    font-weight: 700;
    border-right: 1px solid rgba(255, 255, 255, 0.05);
  }

  .choice-text {
    padding: 0.75rem 1rem;
    flex-grow: 1;
    font-weight: 500;
  }

  .choice-status {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding-right: 1rem;
  }

  /* Choice States */
  .choice-correct {
    border-color: rgba(52, 211, 153, 0.4);
    background: rgba(52, 211, 153, 0.08);
    color: var(--cse-green);
  }
  .choice-correct .choice-letter {
    background: var(--cse-green);
    color: #022c22;
    border-right-color: rgba(52, 211, 153, 0.4);
  }
  .correct-status {
    color: var(--cse-green);
  }

  .choice-wrong {
    border-color: rgba(248, 113, 113, 0.4);
    background: rgba(248, 113, 113, 0.08);
    color: var(--cse-red);
  }
  .choice-wrong .choice-letter {
    background: var(--cse-red);
    color: #450a0a;
    border-right-color: rgba(248, 113, 113, 0.4);
  }
  .wrong-status {
    color: var(--cse-red);
  }

  .choice-disabled {
    opacity: 0.5;
  }

  .explanation {
    padding: 1rem;
    background: rgba(255, 255, 255, 0.02);
    border-left: 3px solid var(--cse-primary);
    border-radius: 0 8px 8px 0;
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--cse-text);
  }

  .explanation strong {
    color: var(--cse-primary-light);
    display: block;
    margin-bottom: 0.25rem;
  }

  .review-footer {
    display: flex;
    justify-content: center;
    border-top: 1px solid var(--cse-border);
    padding-top: 2rem;
  }

  @media (max-width: 600px) {
    .result-container { padding: 1rem; }
    .score-circle { width: 100px; height: 100px; font-size: 2rem; }
    .stat-cards-grid { grid-template-columns: 1fr; }
    .review-meta-container { flex-direction: column; align-items: flex-start; gap: 1rem; }
    .review-item { padding: 1rem; }
    .q-text { font-size: 1rem; margin-bottom: 1.2rem; }
    .choice-text { padding: 0.6rem 0.8rem; font-size: 0.85rem; }
    .review-item-header { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
  }
</style>
