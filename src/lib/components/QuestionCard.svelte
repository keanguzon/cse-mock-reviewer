<script lang="ts">
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
    onSelect 
  } = $props<{
    question: Question;
    hasAnswered: boolean;
    selectedAnswer: string | null;
    isPractice: boolean;
    onSelect: (choice: string) => void;
  }>();

  const getChoiceClass = (choice: string) => {
    if (!hasAnswered) return 'choice-btn';
    
    const isSelected = selectedAnswer === choice;
    const isCorrect = choice === question.correct_answer;
    
    if (isPractice) {
      if (isCorrect) return 'choice-btn correct';
      if (isSelected && !isCorrect) return 'choice-btn wrong';
      return 'choice-btn disabled';
    } else {
      if (isSelected) return 'choice-btn selected';
      return 'choice-btn disabled';
    }
  };
</script>

<article class="glass-panel slide-up">
  <header class="q-header">
    <span class="category-badge">{question.category}</span>
  </header>
  
  <h2 class="q-text">{question.question}</h2>
  
  <div class="choices-grid">
    {#each question.choices as choice, i}
      <button 
        class={getChoiceClass(choice)}
        onclick={() => !hasAnswered && onSelect(choice)}
        disabled={hasAnswered}
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

  {#if hasAnswered && isPractice && question.explanation}
    <footer class="explanation slide-up">
      <small><strong>Explanation:</strong></small>
      <p>{question.explanation}</p>
    </footer>
  {/if}
</article>

<style>
  .q-header {
    margin-bottom: var(--size-4);
    border-bottom: 1px solid var(--gray-3);
    padding-bottom: var(--size-2);
  }

  :global([data-theme="dark"]) .q-header {
    border-bottom-color: var(--gray-8);
  }

  .category-badge {
    background: var(--primary);
    color: white;
    padding: var(--size-1) var(--size-2);
    border-radius: var(--radius-2);
    font-size: var(--font-size-0);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .q-text {
    font-size: var(--font-size-4);
    font-weight: 800;
    line-height: 1.3;
    margin-bottom: var(--size-6);
  }

  .choices-grid {
    display: flex;
    flex-direction: column;
    gap: var(--size-3);
  }

  .choice-btn {
    display: flex;
    align-items: center;
    text-align: left;
    width: 100%;
    padding: 0;
    border: 2px solid var(--gray-3);
    background: var(--gray-0);
    border-radius: var(--radius-2);
    overflow: hidden;
    transition: var(--transition);
    cursor: pointer;
    color: var(--gray-9);
  }

  :global([data-theme="dark"]) .choice-btn {
    border-color: var(--gray-7);
    background: var(--gray-9);
    color: var(--gray-1);
  }

  .choice-btn:not(:disabled):hover {
    border-color: var(--primary);
    transform: translateY(-2px);
    box-shadow: var(--shadow-2);
  }

  .choice-letter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    align-self: stretch;
    background: var(--gray-2);
    font-weight: bold;
    font-size: var(--font-size-3);
    border-right: 2px solid var(--gray-3);
    transition: var(--transition);
  }

  :global([data-theme="dark"]) .choice-letter {
    background: var(--gray-8);
    border-color: var(--gray-7);
  }

  .choice-btn:not(:disabled):hover .choice-letter {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }

  .choice-text {
    padding: var(--size-3);
    flex-grow: 1;
    font-weight: 500;
  }

  /* States */
  .choice-btn.correct {
    border-color: var(--green-6);
    background: var(--green-0);
    color: var(--green-9);
  }
  .choice-btn.correct .choice-letter {
    background: var(--green-6);
    color: white;
    border-color: var(--green-6);
  }

  .choice-btn.wrong {
    border-color: var(--red-6);
    background: var(--red-0);
    color: var(--red-9);
  }
  .choice-btn.wrong .choice-letter {
    background: var(--red-6);
    color: white;
    border-color: var(--red-6);
  }

  .choice-btn.selected {
    border-color: var(--primary);
    background: var(--indigo-0);
  }
  .choice-btn.selected .choice-letter {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
  }

  .choice-btn.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .status-icon {
    padding-right: var(--size-4);
    font-weight: bold;
    font-size: var(--font-size-1);
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .correct-icon { color: var(--green-6); }
  .wrong-icon { color: var(--red-6); }

  .explanation {
    margin-top: var(--size-5);
    padding: var(--size-4);
    background: var(--gray-1);
    border-left: 4px solid var(--primary);
    border-radius: 0 var(--radius-2) var(--radius-2) 0;
  }

  :global([data-theme="dark"]) .explanation {
    background: var(--gray-9);
  }
</style>
