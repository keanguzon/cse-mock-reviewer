<script lang="ts">
  import { goto } from '$app/navigation';
  import QuestionCard from '$lib/components/QuestionCard.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import ResultScreen from '$lib/components/ResultScreen.svelte';

  let { data } = $props<{
    data: {
      questions: any[];
      mode: string;
      category: string;
    }
  }>();

  let questions = $state(data.questions);
  let isPractice = $state(data.mode === 'practice');
  
  let currentIndex = $state(0);
  let score = $state(0);
  let userAnswers = $state<Record<number, string>>({});
  
  let currentQuestion = $derived(questions[currentIndex]);
  let hasAnswered = $derived(userAnswers[currentIndex] !== undefined);
  let selectedAnswer = $derived(userAnswers[currentIndex] || null);
  let isFinished = $derived(currentIndex >= questions.length && questions.length > 0);

  function handleSelect(choice: string) {
    if (hasAnswered) return;
    
    userAnswers[currentIndex] = choice;
    if (choice === currentQuestion.correct_answer) {
      score += 1;
    }
  }

  function handleNext() {
    currentIndex += 1;
  }

  function handleExit() {
    goto('/');
  }
</script>

{#if questions.length === 0}
  <div class="glass-panel text-center fade-in">
    <h2>No Questions Found</h2>
    <p>We couldn't find any questions for the selected category.</p>
    <button onclick={handleExit} class="primary-btn mt-4">Go Back</button>
  </div>
{:else if isFinished}
  <ResultScreen 
    {score} 
    total={questions.length} 
    onExit={handleExit} 
  />
{:else}
  <div class="quiz-container fade-in">
    <ProgressBar 
      current={currentIndex} 
      total={questions.length} 
      {score} 
      {isPractice} 
    />

    <QuestionCard 
      question={currentQuestion}
      {hasAnswered}
      {selectedAnswer}
      {isPractice}
      onSelect={handleSelect}
    />

    <footer class="quiz-actions slide-up" style="animation-delay: 0.2s">
      <div class="status-text">
        {#if hasAnswered}
          {#if isPractice}
            {#if selectedAnswer === currentQuestion.correct_answer}
              <span class="text-emerald">✓ Nice work!</span>
            {:else}
              <span class="text-red">✗ Review the explanation above.</span>
            {/if}
          {:else}
            <span>Answer locked.</span>
          {/if}
        {:else}
          <span>Select an answer above.</span>
        {/if}
      </div>

      <div class="action-buttons">
        {#if hasAnswered}
          <button class="primary-btn pulse-anim" onclick={handleNext}>
            {currentIndex + 1 >= questions.length ? 'View Results' : 'Next Question'}
          </button>
        {:else}
          <button class="text-btn" onclick={handleExit}>Exit Session</button>
        {/if}
      </div>
    </footer>
  </div>
{/if}

<style>
  .quiz-container {
    max-width: 800px;
    margin: 0 auto var(--size-8);
  }

  .text-center { text-align: center; }
  .mt-4 { margin-top: var(--size-4); }
  .text-emerald { color: var(--green-6); font-weight: bold; }
  .text-red { color: var(--red-6); font-weight: bold; }

  .quiz-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--size-6);
    padding-top: var(--size-4);
    border-top: 1px solid var(--gray-3);
  }

  :global([data-theme="dark"]) .quiz-actions {
    border-top-color: var(--gray-8);
  }

  .status-text {
    font-size: var(--font-size-2);
    color: var(--gray-6);
    font-weight: 600;
  }

  .primary-btn {
    background: var(--primary);
    color: white;
    border: none;
    padding: var(--size-3) var(--size-5);
    font-size: var(--font-size-2);
    font-weight: 700;
    border-radius: var(--radius-2);
    cursor: pointer;
    transition: var(--transition);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .primary-btn:hover {
    background: var(--primary-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-3);
  }

  .text-btn {
    background: transparent;
    border: none;
    color: var(--gray-5);
    font-size: var(--font-size-1);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    cursor: pointer;
    transition: var(--transition);
  }

  .text-btn:hover {
    color: var(--gray-9);
  }

  :global([data-theme="dark"]) .text-btn:hover {
    color: var(--gray-1);
  }

  .pulse-anim {
    animation: pulse-border 2s infinite;
  }

  @keyframes pulse-border {
    0% { box-shadow: 0 0 0 0 rgba(var(--indigo-6-hsl), 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(var(--indigo-6-hsl), 0); }
    100% { box-shadow: 0 0 0 0 rgba(var(--indigo-6-hsl), 0); }
  }
</style>
