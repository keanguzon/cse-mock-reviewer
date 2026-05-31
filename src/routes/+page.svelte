<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { userSession } from '$lib/userSession.svelte';
  import Dashboard from '$lib/components/Dashboard.svelte';
  import ColorBendsBackground from '$lib/components/ColorBendsBackground.svelte';
  import BlurText from '$lib/components/BlurText.svelte';
  import { getCategoryCountsForLevel, getCategoriesForLevel, type ExamLevel } from '$lib/questions';

  let selectedLevel = $state<ExamLevel>('professional');
  let selectedMode = $state('practice');
  let selectedCategory = $state('');
  let selectedLimit = $state('20');

  let categoryCounts = $derived(getCategoryCountsForLevel(selectedLevel));
  let availableCategories = $derived(getCategoriesForLevel(selectedLevel));
  let maxQuestions = $derived(categoryCounts[selectedCategory] || categoryCounts[''] || 0);

  let hasSavedSession = $state(false);
  let savedSessionData = $state<any>(null);

  // Reset category when switching levels
  $effect(() => {
    selectedLevel; // track
    selectedCategory = '';
  });

  $effect(() => {
    if (parseInt(selectedLimit) > maxQuestions) {
      selectedLimit = maxQuestions.toString();
    }
  });

  onMount(() => {
    const raw = localStorage.getItem('cse_active_session');
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (data && data.questions && data.questions.length > 0) {
          savedSessionData = data;
          hasSavedSession = true;
        }
      } catch (e) {
        console.error("Error reading saved session:", e);
      }
    }
  });

  function startQuiz() {
    let url = `/quiz?mode=${selectedMode}&level=${selectedLevel}`;
    if (selectedCategory) url += `&category=${encodeURIComponent(selectedCategory)}`;
    url += `&limit=${selectedLimit}`;
    goto(url);
  }

  function continueSession() {
    goto('/quiz?continue=true');
  }

  function discardSession() {
    if (window.confirm("Are you sure you want to discard your saved session? Your progress will be lost permanently.")) {
      localStorage.removeItem('cse_active_session');
      hasSavedSession = false;
      savedSessionData = null;
    }
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    startQuiz();
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });
    if (error) console.error("Error logging in:", error.message);
  }
</script>

<!-- Animated WebGL Background -->
<ColorBendsBackground />

<div style="position: relative; z-index: 1;">

{#if userSession.loading}
  <!-- Loading State -->
  <div class="hero-section">
    <div style="text-align: center;">
      <progress class="progress" max="100" style="max-width: 200px; margin: 0 auto;"></progress>
      <p style="color: #7c6d8e; margin-top: 1rem; font-size: 0.9rem;">Syncing session...</p>
    </div>
  </div>

{:else if userSession.user}
  <!-- ============================================
       AUTHENTICATED VIEW: Dashboard + Quiz Config
  ============================================ -->
  <div class="auth-view">
    <Dashboard user={userSession.user} />

    {#if hasSavedSession}
      <div class="glass-card slide-up continue-session-card" style="max-width: 640px; margin: 0 auto 2rem; border-color: rgba(167, 139, 250, 0.45); background: rgba(124, 58, 237, 0.04); position: relative; overflow: hidden;">
        <!-- Glowing gradient effect under card -->
        <div style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle, rgba(124, 58, 237, 0.08) 0%, transparent 60%); pointer-events: none; z-index: 0;"></div>
        
        <div style="position: relative; z-index: 1;" class="continue-flex-container">
          <div style="flex: 1;">
            <span class="cse-badge cse-badge-primary" style="margin-bottom: 0.6rem; background: rgba(167, 139, 250, 0.2); border-color: rgba(167, 139, 250, 0.4);">Saved Session Detected</span>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: white; font-family: var(--font-display); letter-spacing: -0.3px;">
              Resume your progress
            </h3>
            <p style="font-size: 0.88rem; color: #a78bfa; margin-top: 0.3rem; line-height: 1.4;">
              <span style="text-transform: capitalize; font-weight: 700;">{savedSessionData?.mode === 'mock' ? '⏱️ Mock Exam' : '📚 Practice Session'}</span> • 
              <span style="font-weight: 600;">{savedSessionData?.level === 'professional' ? 'Professional' : 'Sub-Professional'}</span> • 
              <span>{savedSessionData?.category || 'All Categories'}</span>
            </p>
            <p style="font-size: 0.82rem; color: var(--cse-text-muted); margin-top: 0.4rem; font-weight: 500;">
              Progress: <strong style="color: white;">{savedSessionData?.currentIndex + 1}</strong> of <strong style="color: white;">{savedSessionData?.questions?.length}</strong> questions
            </p>
          </div>
          <div class="continue-actions-buttons" style="display: flex; gap: 0.75rem; flex-direction: column; align-items: stretch; min-width: 180px;">
            <button class="btn-primary" onclick={continueSession} style="padding: 0.75rem 1.5rem; font-size: 0.9rem; text-align: center;">
              Resume Session →
            </button>
            <button class="btn-ghost" onclick={discardSession} style="padding: 0.75rem 1.5rem; font-size: 0.9rem; border-color: rgba(248, 113, 113, 0.2); color: var(--cse-red); font-weight: 700; text-align: center;">
              Discard
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Quiz Config -->
    <div id="quiz-config" class="glass-card slide-up" style="max-width: 640px; margin: 0 auto;">
      <h2 style="font-size: 1.1rem; font-weight: 700; color: white; margin-bottom: 1.5rem; letter-spacing: -0.3px; font-family: var(--font-display);">
        Configure Your Session
      </h2>

      <form onsubmit={handleSubmit}>
        <!-- Exam Level Selection -->
        <div class="field" style="margin-bottom: 1.5rem;">
          <label class="label">Exam Level</label>
          <div class="mode-grid">
            <label class="mode-card {selectedLevel === 'professional' ? 'selected' : ''}" for="level-pro">
              <input type="radio" id="level-pro" name="level" value="professional" bind:group={selectedLevel} style="display:none">
              <span style="font-size: 1.8rem; display: block; margin-bottom: 0.5rem;">🎓</span>
              <strong>Professional</strong>
              <p>Includes Analytical Reasoning</p>
            </label>

            <label class="mode-card {selectedLevel === 'subprofessional' ? 'selected' : ''}" for="level-sub">
              <input type="radio" id="level-sub" name="level" value="subprofessional" bind:group={selectedLevel} style="display:none">
              <span style="font-size: 1.8rem; display: block; margin-bottom: 0.5rem;">🏢</span>
              <strong>Sub-Professional</strong>
              <p>Includes Clerical Ability</p>
            </label>
          </div>
        </div>

        <!-- Mode Selection -->
        <div class="field" style="margin-bottom: 1.5rem;">
          <label class="label">Exam Mode</label>
          <div class="mode-grid">
            <label class="mode-card {selectedMode === 'practice' ? 'selected' : ''}" for="mode-practice">
              <input type="radio" id="mode-practice" name="mode" value="practice" bind:group={selectedMode} style="display:none">
              <span style="font-size: 1.8rem; display: block; margin-bottom: 0.5rem;">📚</span>
              <strong>Practice Mode</strong>
              <p>Instant feedback after each answer</p>
            </label>

            <label class="mode-card {selectedMode === 'mock' ? 'selected' : ''}" for="mode-mock">
              <input type="radio" id="mode-mock" name="mode" value="mock" bind:group={selectedMode} style="display:none">
              <span style="font-size: 1.8rem; display: block; margin-bottom: 0.5rem;">⏱️</span>
              <strong>Mock Exam</strong>
              <p>Results revealed at the end</p>
            </label>
          </div>
        </div>

        <!-- Category -->
        <div class="field" style="margin-bottom: 1.5rem;">
          <label class="label" for="category-select">Category</label>
          <div class="select is-fullwidth">
            <select id="category-select" bind:value={selectedCategory}>
              <option value="">All Categories (Mixed)</option>
              {#each availableCategories as cat}
                <option value={cat}>{cat}</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Number of Questions -->
        <div class="field" style="margin-bottom: 2rem;">
          <label class="label" for="limit-select">Number of Questions</label>
          <div class="select is-fullwidth">
            <select id="limit-select" bind:value={selectedLimit}>
              {#if maxQuestions >= 10}
                <option value="10">10 Questions (Quick Review)</option>
              {/if}
              {#if maxQuestions >= 20}
                <option value="20">20 Questions (Standard)</option>
              {/if}
              {#if maxQuestions >= 50}
                <option value="50">50 Questions (Deep Dive)</option>
              {/if}
              {#if ![10, 20, 50].includes(maxQuestions)}
                <option value={maxQuestions.toString()}>All {maxQuestions} Questions (Full)</option>
              {/if}
            </select>
          </div>
        </div>

        <button type="submit" class="btn-primary" style="width: 100%; font-size: 1rem; padding: 1rem; letter-spacing: 1px; text-transform: uppercase;">
          Start Review Session →
        </button>
      </form>
    </div>
  </div>

{:else}
  <!-- ============================================
       GUEST VIEW: Centered Premium Landing Page
  ============================================ -->
  <div class="landing-container">
    <!-- Hero Content -->
    <div class="landing-hero">
      <!-- Title -->
      <h1 class="hero-title">
        <BlurText text="Ace the" delay={150} />
        <br />
        <span class="gradient-text hero-title-gradient-word" style="animation-delay: 400ms;">
          Civil Service
        </span>
        <br />
        <BlurText text="Exam." delay={900} />
      </h1>

      <!-- Subtitle -->
      <p class="hero-subtitle">
        Smart mock exams with instant feedback, category analytics, and progress tracking — built for Filipino civil service aspirants.
      </p>

      <!-- CTA Buttons -->
      <div class="hero-ctas">
        <!-- Primary: Get Started -->
        <button class="btn-get-started" onclick={signInWithGoogle}>
          Start your review <span style="font-weight: 300;">→</span>
        </button>

        <p class="hero-hint">Sign in to save your scores and track progress</p>
      </div>
    </div>
  </div>
{/if}

</div>

<style>
  /* ---- Hero Section (used for loading state) ---- */
  .hero-section {
    min-height: 85vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 1rem;
  }

  /* ---- Auth View ---- */
  .auth-view {
    max-width: 800px;
    margin: 0 auto;
    padding: 3rem 1.5rem 5rem;
  }

  /* ---- Landing Layout ---- */
  .landing-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 85vh;
    padding: 4rem 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .landing-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    max-width: 800px;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }

  @media (max-width: 900px) {
    .landing-container {
      justify-content: center;
      padding: 2rem 1rem;
    }
    .landing-hero {
      align-items: center;
      text-align: center;
    }
  }

  .hero-title {
    font-size: clamp(2.8rem, 7vw, 5.5rem);
    font-weight: 900;
    line-height: 1.08;
    letter-spacing: -2px;
    color: white;
    margin-bottom: 1.5rem;
    font-family: var(--font-display);
  }

  .hero-subtitle {
    font-size: clamp(1rem, 2vw, 1.15rem);
    color: #e2e8f0;
    max-width: 48ch;
    line-height: 1.65;
    margin-bottom: 2.5rem;
    opacity: 0;
    animation: fadeUp 0.6s 1.1s ease both;
  }

  .hero-ctas {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    opacity: 0;
    animation: fadeUp 0.6s 1.4s ease both;
  }

  @media (max-width: 900px) {
    .hero-ctas {
      align-items: center;
    }
  }

  .hero-hint {
    font-size: 0.85rem;
    color: #cbd5e1;
    margin-top: 0.5rem;
  }

  /* ---- Button ---- */
  .btn-get-started {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 2.5rem;
    background: #4a0494; /* Darker purple for better contrast */
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 1.15rem;
    font-weight: 700;
    font-family: var(--font-body);
    cursor: pointer;
    transition: transform 0.2s ease, background 0.2s ease;
    letter-spacing: 0.3px;
    box-shadow: 0 4px 14px rgba(74, 4, 148, 0.5);
  }

  .btn-get-started:hover {
    background: #5c0ab5;
    transform: translateY(-2px);
  }

  .hero-title-gradient-word {
    display: inline-block;
    opacity: 0;
    filter: blur(12px);
    transform: translateY(6px);
    animation: blurInWord 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  @keyframes blurInWord {
    to {
      opacity: 1;
      filter: blur(0px);
      transform: translateY(0);
    }
  }

  /* ---- Mode cards ---- */
  .mode-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .mode-card {
    display: block;
    padding: 1.25rem;
    border: 2px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: rgba(255,255,255,0.03);
    text-align: center;
    color: #94a3b8;
  }

  .mode-card strong {
    display: block;
    color: #cbd5e1;
    font-size: 0.95rem;
    margin-bottom: 0.3rem;
  }

  .mode-card p {
    font-size: 0.8rem;
    color: #475569;
    margin: 0;
    line-height: 1.4;
  }

  .mode-card:hover {
    border-color: rgba(99, 102, 241, 0.4);
    background: rgba(99, 102, 241, 0.05);
  }

  .mode-card.selected {
    border-color: #6366f1;
    background: rgba(99, 102, 241, 0.12);
  }

  .mode-card.selected strong {
    color: #a5b4fc;
  }

  /* ---- Keyframes ---- */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ---- Continue Session layout responsive ---- */
  .continue-flex-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    gap: 1.5rem;
  }

  @media (max-width: 600px) {
    .continue-flex-container {
      flex-direction: column;
      align-items: stretch !important;
      gap: 1.25rem;
    }
    .continue-actions-buttons {
      flex-direction: row !important;
      width: 100%;
    }
    .continue-actions-buttons button {
      flex: 1;
    }
  }
</style>
