<script lang="ts">
  import { RotateCcw } from 'lucide-svelte';

  type Question = {
    id: string;
    question: string;
    choices: string[];
    correct_answer: string;
    explanation?: string;
    category: string;
  };

  let { 
    question, 
    hasAnswered, 
    selectedAnswer, 
    isPractice,
    currentIndex,
    total,
    onSelect,
    onClear
  } = $props<{
    question: Question;
    hasAnswered: boolean;
    selectedAnswer: string | null;
    isPractice: boolean;
    currentIndex: number;
    total: number;
    onSelect: (choice: string) => void;
    onClear?: () => void;
  }>();

  const getChoiceClass = (choice: string) => {
    const isSelected = selectedAnswer === choice;

    const isCorrect = choice === question.correct_answer;
    
    if (isPractice) {
      if (!hasAnswered) return isSelected ? 'choice-btn pending' : 'choice-btn';
      if (isCorrect) return 'choice-btn correct';
      if (isSelected && !isCorrect) return 'choice-btn wrong';
      return 'choice-btn disabled';
    } else {
      if (isSelected) return 'choice-btn selected';
      return 'choice-btn';
    }
  };
</script>

<article class="glass-card slide-up">
  <header class="q-header">
    <span class="category-badge">{question.category}</span>
    <span class="page-number">Question {currentIndex + 1} of {total}</span>
  </header>
  
  <h2 class="q-text">{@html question.question.replace(/_+/g, '<span class="blank-line"></span>')}</h2>
  
  <div class="choices-grid">
    {#each question.choices as choice, i}
      <button 
        class={getChoiceClass(choice)}
        onclick={() => { if (!isPractice || !hasAnswered) onSelect(choice); }}
        disabled={isPractice && hasAnswered}
        aria-pressed={selectedAnswer === choice}
      >
        <span class="choice-letter">{String.fromCharCode(65 + i)}</span>
        <span class="choice-text">{choice}</span>
        
        {#if hasAnswered && isPractice}
          {#if choice === question.correct_answer}
            <span class="status-icon correct-icon">✓ Correct</span>
          {:else if selectedAnswer === choice}
            <span class="status-icon wrong-icon">✗ Wrong</span>
          {/if}
        {/if}
      </button>
    {/each}
  </div>

  {#if selectedAnswer !== null && onClear}
    <div class="clear-selection-container">
      <button type="button" class="btn-clear-selection" onclick={onClear}>
        <RotateCcw size={13} /> Clear Selection
      </button>
    </div>
  {/if}

  {#if hasAnswered && isPractice && question.explanation}
    <footer class="explanation slide-up">
      <small><strong>Explanation:</strong></small>
      <p>{question.explanation}</p>
    </footer>
  {/if}
</article>

<style>
  .q-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--cse-border);
    padding-bottom: 1rem;
  }

  .page-number {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--cse-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .category-badge {
    display: inline-block;
    background: rgba(124, 58, 237, 0.15);
    color: var(--cse-primary-light);
    padding: 0.35rem 0.8rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    border: 1px solid rgba(124, 58, 237, 0.3);
  }

  .q-text {
    font-family: var(--font-body);
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.5;
    margin-bottom: 2rem;
    color: white;
  }

  :global(.blank-line) {
    display: inline-block;
    width: 60px;
    border-bottom: 2px solid white;
    margin: 0 4px;
    vertical-align: middle;
  }

  :global(.q-text u) {
    text-decoration: underline;
    text-decoration-color: var(--cse-primary-light);
    text-underline-offset: 3px;
    text-decoration-thickness: 2px;
    font-weight: 700;
  }

  .choices-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .choice-btn {
    display: flex;
    align-items: center;
    text-align: left;
    width: 100%;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    color: var(--cse-text);
  }

  .choice-btn:not(:disabled):hover {
    border-color: rgba(139, 92, 246, 0.5);
    background: rgba(139, 92, 246, 0.08);
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(124, 58, 237, 0.15);
  }

  .choice-letter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.5rem;
    align-self: stretch;
    background: rgba(255, 255, 255, 0.05);
    font-weight: 700;
    font-size: 1.1rem;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    transition: all 0.2s ease;
  }

  .choice-btn:not(:disabled):hover .choice-letter {
    background: var(--cse-primary);
    color: white;
    border-color: var(--cse-primary);
  }

  .choice-text {
    padding: 1rem;
    flex-grow: 1;
    font-weight: 500;
    font-size: 0.95rem;
  }

  /* States */
  .choice-btn.pending {
    border-color: rgba(124, 58, 237, 0.6);
    background: rgba(124, 58, 237, 0.12);
  }
  .choice-btn.pending .choice-letter {
    background: rgba(124, 58, 237, 0.25);
    color: white;
    border-color: rgba(124, 58, 237, 0.6);
  }

  .choice-btn.correct {
    border-color: var(--cse-green);
    background: rgba(52, 211, 153, 0.12);
    color: var(--cse-green);
  }
  .choice-btn.correct .choice-letter {
    background: var(--cse-green);
    color: #022c22;
    border-color: var(--cse-green);
  }

  .choice-btn.wrong {
    border-color: var(--cse-red);
    background: rgba(248, 113, 113, 0.12);
    color: var(--cse-red);
  }
  .choice-btn.wrong .choice-letter {
    background: var(--cse-red);
    color: #450a0a;
    border-color: var(--cse-red);
  }

  .choice-btn.selected {
    border-color: var(--cse-primary);
    background: rgba(124, 58, 237, 0.15);
    box-shadow: 0 0 0 1px var(--cse-primary);
  }
  .choice-btn.selected .choice-letter {
    background: var(--cse-primary);
    color: white;
    border-color: var(--cse-primary);
  }

  .choice-btn.disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .status-icon {
    padding-right: 1rem;
    font-weight: 700;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .correct-icon { color: var(--cse-green); }
  .wrong-icon { color: var(--cse-red); }

  .clear-selection-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.75rem;
  }

  .btn-clear-selection {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    border-radius: 8px;
    padding: 0.4rem 0.75rem;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: var(--font-body);
  }

  .btn-clear-selection:hover {
    background: rgba(248, 113, 113, 0.12);
    border-color: rgba(248, 113, 113, 0.3);
    color: var(--cse-red);
  }

  .explanation {
    margin-top: 1.5rem;
    padding: 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border-left: 4px solid var(--cse-primary);
    border-radius: 0 12px 12px 0;
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--cse-text);
  }
</style>
