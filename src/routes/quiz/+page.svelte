<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import QuestionCard from '$lib/components/QuestionCard.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import ResultScreen from '$lib/components/ResultScreen.svelte';

  let { data } = $props<{
    data: {
      questions: any[];
      mode: string;
      category: string;
      level?: string;
    }
  }>();

  let questions = $state(data?.questions || []);
  let currentMode = $state(data?.mode || 'practice');
  let currentCategory = $state(data?.category || '');
  let currentLevel = $state(data?.level || 'professional');
  
  let isPractice = $derived(currentMode === 'practice');
  
  let currentIndex = $state(0);
  let score = $state(0);
  let userAnswers = $state<Record<number, string>>({});
  let pendingAnswer = $state<string | null>(null);
  
  let currentQuestion = $derived(questions && questions.length > 0 && currentIndex < questions.length ? questions[currentIndex] : null);
  let hasAnswered = $derived(userAnswers[currentIndex] !== undefined);
  let selectedAnswer = $derived(hasAnswered ? userAnswers[currentIndex] : pendingAnswer);
  let isFinished = $derived(questions && questions.length > 0 && currentIndex >= questions.length);

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('continue') === 'true') {
      const raw = localStorage.getItem('cse_active_session');
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (saved && saved.questions && saved.questions.length > 0) {
            questions = saved.questions;
            currentIndex = saved.currentIndex;
            userAnswers = saved.userAnswers || {};
            score = saved.score || 0;
            currentMode = saved.mode;
            currentCategory = saved.category || '';
            currentLevel = saved.level || 'professional';
            pendingAnswer = saved.pendingAnswer || null;
            return;
          }
        } catch (e) {
          console.error("Error loading session:", e);
        }
      }
      // Fallback if no valid session data
      goto('/');
    }
  });

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

  function handleSaveAndClose() {
    const sessionData = {
      questions,
      currentIndex,
      userAnswers,
      score,
      mode: currentMode,
      category: currentCategory,
      level: currentLevel,
      pendingAnswer
    };
    localStorage.setItem('cse_active_session', JSON.stringify(sessionData));
    goto('/');
  }

  function handleTerminateSession() {
    if (window.confirm("Are you sure you want to terminate your exam session? Your current progress will be lost permanently.")) {
      localStorage.removeItem('cse_active_session');
      goto('/');
    }
  }

  function handleSubmitExam() {
    // Automatically record selected answer for the last question if mock mode and not confirmed
    if (!isPractice && !hasAnswered && pendingAnswer) {
      userAnswers[currentIndex] = pendingAnswer;
      if (pendingAnswer === currentQuestion.correct_answer) {
        score += 1;
      }
    }
    
    localStorage.removeItem('cse_active_session');
    currentIndex = questions.length;
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
    category={currentCategory || 'All Categories'}
    mode={currentMode}
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
      <div class="session-buttons">
        {#if currentIndex < questions.length - 1}
          <button class="btn-dark" onclick={handleSaveAndClose}>
            Save and Close
          </button>
          <button class="btn-terminate" onclick={handleTerminateSession}>
            Terminate Session
          </button>
        {:else}
          <button class="btn-dark" onclick={handleSaveAndClose}>
            Save and Close
          </button>
        {/if}
      </div>

      <div class="status-text hidden-mobile">
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
        {#if currentIndex < questions.length - 1}
          {#if hasAnswered}
            <button class="btn-primary pulse-anim" onclick={handleNext}>
              Next Question
            </button>
          {:else}
            <button class="btn-primary" onclick={handleConfirm} disabled={!pendingAnswer}>
              Confirm Answer
            </button>
          {/if}
        {:else}
          {#if isPractice}
            {#if hasAnswered}
              <button class="btn-primary btn-submit pulse-anim" onclick={handleSubmitExam}>
                Submit
              </button>
            {:else}
              <button class="btn-primary" onclick={handleConfirm} disabled={!pendingAnswer}>
                Confirm Answer
              </button>
            {/if}
          {:else}
            <button class="btn-primary btn-submit pulse-anim" onclick={handleSubmitExam} disabled={!pendingAnswer && !hasAnswered}>
              Submit
            </button>
          {/if}
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

  .session-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .btn-dark {
    background: rgba(0, 0, 0, 0.7);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    font-weight: 600;
    padding: 0.75rem 1.25rem;
    cursor: pointer;
    font-family: 'Inter', sans-serif;
    font-size: 0.85rem;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    transition: var(--cse-transition);
  }

  .btn-dark:hover {
    background: #000000;
    color: white;
    border-color: rgba(124, 58, 237, 0.4);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
    transform: translateY(-1px);
  }

  .btn-terminate {
    background: rgba(248, 113, 113, 0.08);
    color: var(--cse-red);
    border: 1px solid rgba(248, 113, 113, 0.2);
    border-radius: 10px;
    font-weight: 600;
    padding: 0.75rem 1.25rem;
    cursor: pointer;
    font-family: 'Inter', sans-serif;
    font-size: 0.85rem;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    transition: var(--cse-transition);
  }

  .btn-terminate:hover {
    background: rgba(248, 113, 113, 0.15);
    border-color: rgba(248, 113, 113, 0.4);
    transform: translateY(-1px);
  }

  .btn-submit {
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
  }

  @media (max-width: 768px) {
    .hidden-mobile {
      display: none !important;
    }
  }

  @media (max-width: 580px) {
    .quiz-actions {
      flex-direction: column-reverse;
      gap: 1.25rem;
      align-items: stretch;
      text-align: center;
    }
    .session-buttons {
      justify-content: stretch;
    }
    .session-buttons button {
      flex: 1;
      padding: 0.75rem 0.5rem;
      font-size: 0.8rem;
    }
    .action-buttons button {
      width: 100%;
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
