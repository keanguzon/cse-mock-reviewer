<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import QuestionCard from '$lib/components/QuestionCard.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import ResultScreen from '$lib/components/ResultScreen.svelte';
  import { userSession } from '$lib/userSession.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { LayoutGrid, ChevronLeft, ChevronRight, AlertTriangle, Info } from 'lucide-svelte';

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
  import { onDestroy } from 'svelte';

  let currentCategory = $state(data?.category || '');
  let currentLevel = $state(data?.level || 'professional');
  
  let isPractice = $derived(currentMode === 'practice');
  
  let currentIndex = $state(0);
  let userAnswers = $state<Record<number, string>>({});
  let pendingAnswer = $state<string | null>(null);
  let showOverview = $state(false);
  let filterUnanswered = $state(false);

  let startTime = $state(Date.now());
  let elapsedSeconds = $state(0);
  let timerInterval = $state<ReturnType<typeof setInterval> | null>(null);
  let timeLimit = $derived(
    currentMode === 'mock' ? Math.ceil((questions?.length || 20) * 1.12) * 60 : 0
  );
  let remainingSeconds = $derived(
    timeLimit > 0 ? Math.max(0, timeLimit - elapsedSeconds) : 0
  );
  let isTimeUp = $derived(timeLimit > 0 && elapsedSeconds >= timeLimit);

  $effect(() => {
    if (isTimeUp && !isFinished) {
      if (timerInterval) clearInterval(timerInterval);
      clearActiveSession();
      currentIndex = questions.length;
    }
  });
  
  // Custom dialog/confirmation modal state
  let showConfirmModal = $state(false);
  let confirmTitle = $state('');
  let confirmMessage = $state('');
  let confirmActionText = $state('');
  let onConfirmCallback = $state<(() => void) | null>(null);
  let isDangerAction = $state(false);
  let isAlertModal = $state(false);

  function triggerConfirm({
    title,
    message,
    actionText,
    isDanger = false,
    isAlert = false,
    callback
  }: {
    title: string;
    message: string;
    actionText: string;
    isDanger?: boolean;
    isAlert?: boolean;
    callback: () => void;
  }) {
    confirmTitle = title;
    confirmMessage = message;
    confirmActionText = actionText;
    isDangerAction = isDanger;
    isAlertModal = isAlert;
    onConfirmCallback = () => {
      callback();
      showConfirmModal = false;
    };
    showConfirmModal = true;
  }
  
  let currentQuestion = $derived(questions && questions.length > 0 && currentIndex < questions.length ? questions[currentIndex] : null);
  let hasAnswered = $derived(userAnswers[currentIndex] !== undefined);
  let selectedAnswer = $derived(hasAnswered ? userAnswers[currentIndex] : pendingAnswer);
  let isFinished = $derived(questions && questions.length > 0 && currentIndex >= questions.length);
  let unansweredCount = $derived(questions ? questions.length - Object.keys(userAnswers).length : 0);
  
  let score = $derived(questions.reduce((total: number, q: any, idx: number) => {
    return total + (userAnswers[idx] === q.correct_answer ? 1 : 0);
  }, 0));

  async function clearActiveSession() {
    if (userSession.user) {
      try {
        await supabase.from('active_sessions').delete().eq('user_id', userSession.user.id);
      } catch (e) {
        console.error('Error clearing active session from Supabase:', e);
      }
    }
    localStorage.removeItem('cse_active_session');
  }

  onMount(async () => {
    // Wait for auth state to resolve before checking session
    if (userSession.loading) {
      await new Promise<void>(resolve => {
        const check = () => userSession.loading ? setTimeout(check, 50) : resolve();
        check();
      });
    }

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('continue') === 'true') {
      let saved: any = null;
      if (userSession.user) {
        try {
          const { data: res } = await supabase
            .from('active_sessions')
            .select('session_data')
            .eq('user_id', userSession.user.id)
            .maybeSingle();
          if (res?.session_data) {
            saved = res.session_data;
          }
        } catch (e) {
          console.error("Error loading session from Supabase:", e);
        }
      }

      if (!saved) {
        const raw = localStorage.getItem('cse_active_session');
        if (raw) {
          try {
            saved = JSON.parse(raw);
          } catch (e) {
            console.error("Error loading session from localStorage:", e);
          }
        }
      }

      if (saved && saved.questions && saved.questions.length > 0) {
        questions = saved.questions;
        currentIndex = saved.currentIndex;
        userAnswers = saved.userAnswers || {};
        currentMode = saved.mode;
        currentCategory = saved.category || '';
        currentLevel = saved.level || 'professional';
        pendingAnswer = saved.pendingAnswer || null;
        if (saved.elapsedSeconds) elapsedSeconds = saved.elapsedSeconds;
      }
    }

    startTime = Date.now() - (elapsedSeconds * 1000);
    timerInterval = setInterval(() => {
      elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    }, 1000);
  });

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
  });

  function handleSelect(choice: string) {
    if (isPractice && hasAnswered) return;
    pendingAnswer = choice;
    if (!isPractice) {
      userAnswers[currentIndex] = choice;
    }
  }

  function handleConfirm() {
    if (!pendingAnswer || (isPractice && hasAnswered)) return;
    userAnswers[currentIndex] = pendingAnswer;
  }

  function handleNext() {
    if (unansweredCount === 0) {
      if (currentIndex < questions.length - 1) {
        currentIndex += 1;
      }
    } else {
      let nextIndex = (currentIndex + 1) % questions.length;
      while (userAnswers[nextIndex]) {
        nextIndex = (nextIndex + 1) % questions.length;
      }
      currentIndex = nextIndex;
    }
    pendingAnswer = userAnswers[currentIndex] || null;
  }

  function handlePrevious() {
    if (currentIndex > 0) {
      currentIndex -= 1;
      pendingAnswer = userAnswers[currentIndex] || null;
    }
  }

  function handleExit() {
    goto('/');
  }

  async function handleSaveAndClose() {
    const sessionData = {
      questions,
      currentIndex,
      userAnswers,
      mode: currentMode,
      category: currentCategory,
      level: currentLevel,
      pendingAnswer,
      elapsedSeconds
    };
    // Always save to local cache as immediate backup
    localStorage.setItem('cse_active_session', JSON.stringify(sessionData));

    if (userSession.user) {
      try {
        await supabase.from('active_sessions').upsert({
          user_id: userSession.user.id,
          session_data: sessionData,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.error('Error saving active session to Supabase:', e);
      }
    }
    goto('/');
  }

  function handleTerminateSession() {
    triggerConfirm({
      title: "Terminate Session",
      message: "Are you sure you want to terminate your exam session? Your current progress will be lost permanently.",
      actionText: "YES, TERMINATE",
      isDanger: true,
      callback: async () => {
        await clearActiveSession();
        goto('/');
      }
    });
  }

  function toggleOverview() {
    showOverview = !showOverview;
  }

  function jumpToQuestion(index: number) {
    currentIndex = index;
    pendingAnswer = userAnswers[currentIndex] || null;
    showOverview = false;
  }

  function handleSubmitExam() {
    if (unansweredCount > 0) {
      triggerConfirm({
        title: "Unfinished Questions",
        message: `You have ${unansweredCount} unanswered questions. Please complete them before submitting.`,
        actionText: "REVIEW QUESTIONS",
        isDanger: false,
        isAlert: true,
        callback: () => {
          showOverview = true;
        }
      });
      return;
    }
    triggerConfirm({
      title: "Submit Exam",
      message: "Are you sure you want to submit your exam now? You will not be able to change your answers.",
      actionText: "SUBMIT NOW",
      isDanger: false,
      callback: async () => {
        if (timerInterval) clearInterval(timerInterval);
        await clearActiveSession();
        currentIndex = questions.length;
      }
    });
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
    level={currentLevel}
    {questions}
    {userAnswers}
    elapsedTime={elapsedSeconds}
    onExit={handleExit} 
  />
{:else}
  <div class="quiz-container fade-in">
    <ProgressBar 
      answeredCount={questions.length - unansweredCount} 
      total={questions.length} 
      {score} 
      {isPractice} 
      {remainingSeconds}
      isMock={currentMode === 'mock'}
    />

    <QuestionCard 
      question={currentQuestion}
      {hasAnswered}
      {selectedAnswer}
      {isPractice}
      {currentIndex}
      total={questions.length}
      onSelect={handleSelect}
    />

    <footer class="quiz-actions slide-up" style="animation-delay: 0.2s">
      <div class="session-buttons">
        {#if currentIndex < questions.length - 1}
          <button class="btn-dark" onclick={handleSaveAndClose}>
            Save and Close
          </button>
          <button class="btn-terminate hidden-mobile" onclick={handleTerminateSession}>
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
            <span>Answered.</span>
          {/if}
        {:else}
          <span>Select an answer above.</span>
        {/if}
      </div>

      <div class="action-buttons">
        <button class="btn-icon" onclick={toggleOverview} title="Question Overview" aria-label="Question Overview">
          <LayoutGrid size={20} />
        </button>

        {#if currentIndex > 0}
          <button class="btn-icon btn-nav-step" onclick={handlePrevious} title="Previous Question" aria-label="Previous">
            <ChevronLeft size={18} />
            <span class="nav-label">PREV</span>
          </button>
        {/if}

        {#if isPractice && !hasAnswered && pendingAnswer}
          <button class="btn-primary uppercase" onclick={handleConfirm}>
            CONFIRM ANSWER
          </button>
        {:else if isPractice && hasAnswered && currentIndex < questions.length - 1}
          <button class="btn-primary btn-next uppercase" onclick={handleNext}>
            NEXT QUESTION →
          </button>
        {:else if currentIndex < questions.length - 1}
          <button class="btn-icon btn-nav-step" onclick={handleNext} title="Next Question" aria-label="Next">
            <span class="nav-label">NEXT</span>
            <ChevronRight size={18} />
          </button>
        {/if}

        {#if unansweredCount === 0}
          <button class="btn-primary btn-submit uppercase" onclick={handleSubmitExam}>
            SUBMIT
          </button>
        {/if}
      </div>
    </footer>
  </div>
{/if}

{#if showOverview}
  <div class="overview-overlay fade-in" onclick={toggleOverview} onkeydown={(e) => e.key === 'Escape' && toggleOverview()} tabindex="0" role="button">
    <div class="overview-modal slide-up" onclick={(e) => e.stopPropagation()} role="dialog">
      <div class="overview-header">
        <h3>Question Overview</h3>
        <button class="close-btn" onclick={toggleOverview} aria-label="Close">✕</button>
      </div>
      
      <div class="overview-filter">
        <label class="filter-label">
          <input type="checkbox" bind:checked={filterUnanswered} />
          <span>Show Unanswered Only</span>
        </label>
      </div>

      <div class="overview-grid">
        {#each questions as _, i}
          {#if !filterUnanswered || !userAnswers[i]}
            <button 
              class="grid-item {userAnswers[i] ? 'answered' : 'unanswered'} {currentIndex === i ? 'current' : ''}"
              onclick={() => jumpToQuestion(i)}
            >
              {i + 1}
            </button>
          {/if}
        {/each}
      </div>
      <div class="overview-footer">
        {#if unansweredCount > 0}
          <p class="unanswered-warning">You have <strong>{unansweredCount}</strong> unanswered questions.</p>
        {:else}
          <p class="all-answered-text text-emerald">All questions answered! Ready to submit.</p>
        {/if}
        <button class="btn-terminate btn-full" onclick={handleTerminateSession}>
          Terminate Session
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showConfirmModal}
  <div class="modal-overlay fade-in" onclick={() => { if (!isAlertModal) showConfirmModal = false; }} onkeydown={(e) => e.key === 'Escape' && !isAlertModal && (showConfirmModal = false)} tabindex="0" role="button">
    <div class="confirm-modal slide-up" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div class="confirm-header">
        {#if isDangerAction}
          <div class="confirm-icon danger-icon">
            <AlertTriangle size={24} />
          </div>
        {:else}
          <div class="confirm-icon info-icon">
            <Info size={24} />
          </div>
        {/if}
        <h3 id="confirm-title">{confirmTitle}</h3>
      </div>
      <div class="confirm-body">
        <p>{confirmMessage}</p>
      </div>
      <div class="confirm-footer">
        {#if !isAlertModal}
          <button class="btn-ghost" onclick={() => showConfirmModal = false}>
            CANCEL
          </button>
        {/if}
        <button class={isDangerAction ? 'btn-danger-confirm' : 'btn-primary'} onclick={() => onConfirmCallback?.()}>
          {confirmActionText}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .quiz-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 1rem 4rem;
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

  .btn-next {
    background: linear-gradient(135deg, var(--cse-green), #059669);
    box-shadow: 0 4px 15px rgba(52, 211, 153, 0.3);
    min-width: 170px;
  }
  .btn-next:hover {
    box-shadow: 0 8px 25px rgba(52, 211, 153, 0.45);
    background: linear-gradient(135deg, #6ee7b7, var(--cse-green));
  }

  .uppercase {
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--cse-text);
    border-radius: 10px;
    padding: 0.65rem;
    cursor: pointer;
    transition: var(--cse-transition);
  }

  .btn-icon:hover {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.4);
    color: var(--cse-primary-light);
  }

  .btn-nav-step {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.65rem 1.1rem;
    font-weight: 700;
  }

  .nav-label {
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
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
    .action-buttons {
      justify-content: space-between;
      width: 100%;
      gap: 0.65rem;
    }
    .action-buttons > button {
      flex: 1;
    }
    .action-buttons > .btn-icon:not(.btn-nav-step) {
      flex: 0 0 auto;
    }
    .btn-nav-step {
      flex: 1 !important;
      padding: 0.75rem 0.5rem;
    }
  }

  .status-text {
    font-size: 0.95rem;
    color: var(--cse-text-muted);
    font-weight: 600;
  }

  /* Modal Styles */
  .overview-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .overview-modal {
    background: #171923;
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 16px;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
  }

  .overview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .overview-header h3 {
    margin: 0;
    font-family: var(--font-display);
    color: var(--cse-primary-light);
  }

  .close-btn {
    background: none; border: none;
    color: var(--cse-text-muted);
    font-size: 1.25rem; cursor: pointer;
  }

  .overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(45px, 1fr));
    gap: 0.75rem;
    padding: 1.5rem;
  }

  .grid-item {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;
  }

  .grid-item.answered {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.5);
    color: white;
  }

  .grid-item.unanswered {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
    color: var(--cse-text-muted);
  }

  .grid-item:hover {
    transform: scale(1.05);
    background: rgba(139, 92, 246, 0.4);
    border-color: var(--cse-primary-light);
    color: white;
  }

  .grid-item.current {
    box-shadow: 0 0 0 2px var(--cse-primary-light);
  }

  .overview-footer {
    padding: 1.5rem;
    border-top: 1px solid rgba(255,255,255,0.05);
    text-align: center;
  }

  .unanswered-warning {
    color: var(--cse-red);
    margin-bottom: 1rem;
    font-size: 0.95rem;
  }
  
  .all-answered-text {
    margin-bottom: 1rem;
    font-size: 0.95rem;
  }

  .btn-full {
    width: 100%;
  }

  /* Custom Confirm Dialog Styles */
  .modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
    padding: 1.5rem;
  }

  .confirm-modal {
    background: #171923;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    width: 100%;
    max-width: 440px;
    box-shadow: 
      0 25px 60px rgba(0, 0, 0, 0.65),
      0 0 40px rgba(124, 58, 237, 0.06);
    overflow: hidden;
    padding: 2rem;
  }

  .confirm-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .confirm-header h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 800;
    color: white;
    letter-spacing: -0.3px;
  }

  .confirm-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 50%;
    margin-bottom: 0.5rem;
  }

  .danger-icon {
    background: rgba(248, 113, 113, 0.12);
    color: var(--cse-red);
    border: 2px solid rgba(248, 113, 113, 0.25);
  }

  .info-icon {
    background: rgba(124, 58, 237, 0.15);
    color: var(--cse-primary-light);
    border: 2px solid rgba(124, 58, 237, 0.3);
  }

  .confirm-body {
    text-align: center;
    margin-bottom: 1.75rem;
  }

  .confirm-body p {
    color: var(--cse-text-muted);
    font-size: 0.95rem;
    line-height: 1.55;
    margin: 0;
  }

  .confirm-footer {
    display: flex;
    gap: 0.75rem;
  }

  .confirm-footer button {
    flex: 1;
    padding: 0.85rem 1rem;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  .btn-danger-confirm {
    background: linear-gradient(135deg, #ef4444, #b91c1c);
    color: white !important;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: var(--cse-transition);
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);
  }

  .btn-danger-confirm:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(239, 68, 68, 0.45);
    background: linear-gradient(135deg, #f87171, #ef4444);
  }

  .btn-danger-confirm:active {
    transform: translateY(0);
  }
</style>
