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

  let questions = $state(data?.questions || []);
  let isPractice = $state(data?.mode === 'practice');
  
  let currentIndex = $state(0);
  let score = $state(0);
  let userAnswers = $state<Record<number, string>>({});
  let pendingAnswer = $state<string | null>(null);
  
  let currentQuestion = $derived(questions && questions.length > 0 && currentIndex < questions.length ? questions[currentIndex] : null);
  let hasAnswered = $derived(userAnswers[currentIndex] !== undefined);
  let selectedAnswer = $derived(hasAnswered ? userAnswers[currentIndex] : pendingAnswer);
  let isFinished = $derived(questions && questions.length > 0 && currentIndex >= questions.length);

  function handleSelect(choice: string) {
    if (hasAnswered) return;
    pendingAnswer = choice;
  }

  function handleConfirm() {
    if (!pendingAnswer || hasAnswered) return;
    
    userAnswers[currentIndex] = pendingAnswer;
    if (pendingAnswer === currentQuestion.correct_answer) {
      score += 1;
    }
  }

  function handleNext() {
    pendingAnswer = null;
    currentIndex += 1;
  }

  function handleExit() {
    goto('/');
  }
</script>

{#if questions.length === 0}
  <div class="glass-card text-center fade-in" style="max-width: 600px; margin: 4rem auto;">
    <h2 style="font-family: var(--font-display); font-size: 1.5rem; margin-bottom: 1rem;">No Questions Found</h2>
    <p style="color: var(--cse-text-muted); margin-bottom: 2rem;">We couldn't find any questions for the selected category.</p>
    <button onclick={handleExit} class="btn-primary">Go Back</button>
  </div>
{:else if isFinished}
  <ResultScreen 
    {score} 
    total={questions.length} 
    category={data.category || 'All Categories'}
    mode={data.mode}
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
          <button class="btn-primary pulse-anim" onclick={handleNext}>
            {currentIndex + 1 >= questions.length ? 'View Results' : 'Next Question'}
          </button>
        {:else if pendingAnswer}
          <button class="btn-primary" onclick={handleConfirm}>
            Confirm Answer
          </button>
        {:else}
          <button class="btn-ghost" onclick={handleExit}>Exit Session</button>
        {/if}
      </div>
    </footer>
  </div>
{/if}

<style>
  .quiz-container {
    max-width: 800px;
    margin: 0 auto 4rem;
    padding: 0 1rem;
  }

  .text-center { text-align: center; }
  .text-emerald { color: var(--cse-green); font-weight: bold; }
  .text-red { color: var(--cse-red); font-weight: bold; }

  .quiz-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--cse-border);
  }

  @media (max-width: 480px) {
    .quiz-actions {
      flex-direction: column-reverse;
      gap: 1rem;
      align-items: stretch;
      text-align: center;
    }
  }

  .status-text {
    font-size: 0.95rem;
    color: var(--cse-text-muted);
    font-weight: 600;
  }

  .pulse-anim {
    animation: pulse-border 2s infinite;
  }

  @keyframes pulse-border {
    0% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.4); }
    70% { box-shadow: 0 0 0 10px rgba(124, 58, 237, 0); }
    100% { box-shadow: 0 0 0 0 rgba(124, 58, 237, 0); }
  }
</style>
