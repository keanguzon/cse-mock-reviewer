<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { userSession } from '$lib/userSession.svelte';
  import Dashboard from '$lib/components/Dashboard.svelte';
  import ColorBendsBackground from '$lib/components/ColorBendsBackground.svelte';
  import BlurText from '$lib/components/BlurText.svelte';
  import { getCategoryCountsForLevel, getCategoriesForLevel, allQuestions, type ExamLevel } from '$lib/questions';
  import { GraduationCap, Building, BookOpen, Timer, Clock, ChevronRight, ArrowLeft } from 'lucide-svelte';
  import { guestStore } from '$lib/guestStore.svelte';

  let selectedLevel = $state<ExamLevel>('professional');
  let selectedMode = $state('practice');
  let selectedCategory = $state('');
  let selectedLimit = $state('20');
  let isGuestMode = $state(false);

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

  let showOnboarding = $state(false);

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      if (!localStorage.getItem('cse_onboarding_seen')) {
        showOnboarding = true;
      }
      if (localStorage.getItem('cse_is_guest') === 'true') {
        isGuestMode = true;
      }
    }

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

  function startGuestMode() {
    isGuestMode = true;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cse_is_guest', 'true');
    }
  }

  function exitGuestMode() {
    isGuestMode = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('cse_is_guest');
    }
  }

  function dismissOnboarding() {
    showOnboarding = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cse_onboarding_seen', 'true');
    }
  }

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

{#snippet quizConfigForm()}
  <div id="quiz-config" class="glass-card slide-up" style="max-width: 640px; margin: 0 auto; position: relative; z-index: 10;">
    <h2 style="font-size: 1.1rem; font-weight: 700; color: white; margin-bottom: 1.5rem; letter-spacing: -0.3px; font-family: var(--font-display);">
      Configure Your Session
    </h2>

    <form onsubmit={handleSubmit}>
      <!-- Exam Level Selection -->
      <div class="field" style="margin-bottom: 1.5rem; position: relative;">
        <label class="label">Exam Level</label>
        <div class="mode-grid">
          <label class="mode-card {selectedLevel === 'professional' ? 'selected' : ''}" for="level-pro">
            <input type="radio" id="level-pro" name="level" value="professional" bind:group={selectedLevel} style="display:none">
            <div style="display: flex; justify-content: center; margin-bottom: 0.75rem; color: #a78bfa;">
              <GraduationCap size={30} style="filter: drop-shadow(0 0 8px rgba(167,139,250,0.3));" />
            </div>
            <strong>Professional</strong>
            <p>Includes Analytical Reasoning</p>
          </label>

          <label class="mode-card {selectedLevel === 'subprofessional' ? 'selected' : ''}" for="level-sub">
            <input type="radio" id="level-sub" name="level" value="subprofessional" bind:group={selectedLevel} style="display:none">
            <div style="display: flex; justify-content: center; margin-bottom: 0.75rem; color: #a78bfa;">
              <Building size={30} style="filter: drop-shadow(0 0 8px rgba(167,139,250,0.3));" />
            </div>
            <strong>Sub-Professional</strong>
            <p>Includes Clerical Ability</p>
          </label>
        </div>

        {#if showOnboarding}
          <div class="onboarding-tooltip slide-up">
            <div class="onboarding-arrow"></div>
            <p class="onboarding-text">
              <strong>Professional Level:</strong> Includes analytical reasoning, word association, and data interpretation (SG 11+ positions).<br><br>
              <strong>Sub-Professional Level:</strong> Includes clerical ability, filing/alphabetizing, and spelling (SG 1-10 positions).
            </p>
            <button type="button" class="btn-onboarding-dismiss" onclick={dismissOnboarding}>
              Got it
            </button>
          </div>
        {/if}
      </div>

      <!-- Mode Selection -->
      <div class="field" style="margin-bottom: 1.5rem;">
        <label class="label">Exam Mode</label>
        <div class="mode-grid">
          <label class="mode-card {selectedMode === 'practice' ? 'selected' : ''}" for="mode-practice">
            <input type="radio" id="mode-practice" name="mode" value="practice" bind:group={selectedMode} style="display:none">
            <div style="display: flex; justify-content: center; margin-bottom: 0.75rem; color: #a78bfa;">
              <BookOpen size={30} style="filter: drop-shadow(0 0 8px rgba(167,139,250,0.3));" />
            </div>
            <strong>Practice Mode</strong>
            <p>Instant feedback after each answer</p>
          </label>

          <label class="mode-card {selectedMode === 'mock' ? 'selected' : ''}" for="mode-mock">
            <input type="radio" id="mode-mock" name="mode" value="mock" bind:group={selectedMode} style="display:none">
            <div style="display: flex; justify-content: center; margin-bottom: 0.75rem; color: #a78bfa;">
              <Timer size={30} style="filter: drop-shadow(0 0 8px rgba(167,139,250,0.3));" />
            </div>
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
{/snippet}

<div style="position: relative; z-index: 1;">

{#if userSession.loading}
  <!-- Loading State -->
  <div class="hero-section">
    <div style="text-align: center;">
      <progress class="progress" max="100" style="max-width: 200px; margin: 0 auto;"></progress>
      <p style="color: #7c6d8e; margin-top: 1rem; font-size: 0.9rem;">Syncing session...</p>
    </div>
  </div>

{:else if userSession.user || isGuestMode}
  <!-- ============================================
       MAIN APP VIEW: Dashboard + Quiz Config (Auth & Guest)
  ============================================ -->
  <div class="auth-view">
    {#if isGuestMode && !userSession.user}
      <div class="guest-mode-header">
        <button class="btn-ghost btn-guest-back" onclick={exitGuestMode}>
          <ArrowLeft size={16} /> <span>Back to Home</span>
        </button>

        <span class="cse-badge cse-badge-primary guest-badge">
          ⚡ Guest Mode <span class="guest-cached-text">(Browser Cached)</span>
        </span>
      </div>
    {/if}

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
            <p style="font-size: 0.88rem; color: #a78bfa; margin-top: 0.3rem; line-height: 1.4; display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
              <span style="text-transform: capitalize; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem;">
                {#if savedSessionData?.mode === 'mock'}
                  <Clock size={14} /> Mock Exam
                {:else}
                  <BookOpen size={14} /> Practice Session
                {/if}
              </span> • 
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

    <!-- Quiz Config for Authenticated User & Guest -->
    {@render quizConfigForm()}
  </div>

{:else}
  <!-- ============================================
       GUEST LANDING: Split-Screen Editorial Hero
  ============================================ -->
  <div class="hero-split">

    <!-- LEFT: Editorial text column -->
    <div class="hero-left">
      <div class="hero-eyebrow">
        <span class="eyebrow-dot"></span>
        <span>Philippine Civil Service Exam Reviewer</span>
      </div>

      <h1 class="hero-title">
        <span class="hero-line-1">
          <BlurText text="Ace the" delay={100} />
        </span>
        <span class="hero-line-accent gradient-text">
          Civil Service
        </span>
        <span class="hero-line-3">
          <BlurText text="Exam." delay={800} />
        </span>
      </h1>

      <p class="hero-body">
        Intelligent mock exams, instant answer feedback, and deep progress analytics — built for Filipino aspirants who mean business.
      </p>

      <div class="hero-stats-row">
        <div class="hero-stat">
          <span class="hero-stat-num">{allQuestions.length}+</span>
          <span class="hero-stat-label">Questions</span>
        </div>
        <div class="hero-stat-divider"></div>
        <div class="hero-stat">
          <span class="hero-stat-num">{new Set(allQuestions.map(q => q.category)).size}</span>
          <span class="hero-stat-label">Categories</span>
        </div>
        <div class="hero-stat-divider"></div>
        <div class="hero-stat">
          <span class="hero-stat-num">Free</span>
          <span class="hero-stat-label">Always</span>
        </div>
      </div>

      <div class="hero-cta-group">
        <button class="btn-hero-primary" onclick={signInWithGoogle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <button class="btn-guest" onclick={startGuestMode}>
          ⚡ Continue as Guest →
        </button>
      </div>

      {#if guestStore.attempts.length > 0}
        <div class="guest-activity-card glass-card slide-up" style="margin-top: 2rem; max-width: 480px; padding: 1.25rem;">
          <h4 style="font-size: 0.85rem; font-weight: 700; color: #a78bfa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.75rem;">Your Cached Results (Guest)</h4>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            {#each guestStore.attempts.slice(0, 3) as att}
              {@const pct = Math.round((att.score / att.total) * 100)}
              <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.8rem;">
                <div>
                  <strong>{att.category || 'All Categories'}</strong>
                  <div style="font-size: 0.7rem; color: #7c6d8e;">{att.mode === 'mock' ? 'Mock Exam' : 'Practice'} · {att.level}</div>
                </div>
                <span style="font-weight: 800; font-family: var(--font-display); color: {pct >= 75 ? '#34d399' : '#fbbf24'};">
                  {att.score}/{att.total} ({pct}%)
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- RIGHT: Animated live preview panel -->
    <div class="hero-right" aria-hidden="true">
      <!-- Floating score badge -->
      <div class="score-badge-float">
        <div class="score-badge-inner">
          <span class="score-badge-num">87%</span>
          <span class="score-badge-label">Last Score</span>
        </div>
        <div class="score-badge-ring"></div>
      </div>

      <div class="preview-card">
        <div class="preview-card-header">
          <div class="preview-dots">
            <span class="pdot red"></span>
            <span class="pdot yellow"></span>
            <span class="pdot green"></span>
          </div>
          <span class="preview-card-title">Verbal Ability &middot; Q12 of 20</span>
        </div>

        <div class="preview-progress-bar">
          <div class="preview-progress-fill" style="width: 60%"></div>
        </div>

        <div class="preview-question">
          <p class="pq-label">CHOOSE THE WORD MOST SIMILAR IN MEANING</p>
          <p class="pq-text">CLANDESTINE</p>
        </div>

        <div class="preview-choices">
          <div class="pc incorrect">
            <span class="pc-letter">A</span>
            <span class="pc-text">Open</span>
          </div>
          <div class="pc correct">
            <span class="pc-letter">B</span>
            <span class="pc-text">Secret</span>
            <span class="pc-mark">✓ Correct</span>
          </div>
          <div class="pc dimmed">
            <span class="pc-letter">C</span>
            <span class="pc-text">Obvious</span>
          </div>
          <div class="pc dimmed">
            <span class="pc-letter">D</span>
            <span class="pc-text">Transparent</span>
          </div>
        </div>

        <div class="preview-explanation">
          <span class="pe-tag">Explanation</span>
          <p>Clandestine means kept secret or done secretively. The closest synonym is <strong>secret</strong>.</p>
        </div>
      </div>

      <!-- Floating category pill -->
      <div class="category-float">
        <span class="cf-dot"></span>
        15 Categories Available
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

  /* ============================================
     EDITORIAL SPLIT-SCREEN HERO
  ============================================ */

  .hero-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4rem;
    align-items: center;
    min-height: calc(100vh - 70px);
    max-width: 1200px;
    margin: 0 auto;
    padding: 4rem 2rem 6rem;
    user-select: none;
    -webkit-user-select: none;
  }

  /* LEFT COLUMN */
  .hero-left {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* Eyebrow */
  .hero-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #7c6d8e;
    margin-bottom: 1.75rem;
    opacity: 0;
    animation: fadeUp 0.5s 0s ease both;
  }

  .eyebrow-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--cse-accent);
    box-shadow: 0 0 8px var(--cse-accent);
    animation: pulse-dot 2s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }

  /* Title */
  .hero-title {
    display: flex;
    flex-direction: column;
    font-family: var(--font-display);
    font-size: clamp(3rem, 6vw, 5.5rem);
    font-weight: 900;
    line-height: 0.95;
    letter-spacing: -3px;
    color: white;
    margin-bottom: 2rem;
    gap: 0.1em;
  }

  .hero-line-1 {
    display: block;
    color: rgba(255,255,255,0.45);
    font-size: 0.65em;
    letter-spacing: -1px;
  }

  .hero-line-accent {
    display: block;
    font-size: 1em;
    opacity: 0;
    filter: blur(12px);
    transform: translateY(8px);
    animation: blurInWord 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.35s forwards;
  }

  .hero-line-3 {
    display: block;
    font-size: 0.9em;
    color: rgba(255,255,255,0.9);
    letter-spacing: -2px;
  }

  @keyframes blurInWord {
    to { opacity: 1; filter: blur(0); transform: translateY(0); }
  }

  /* Body text */
  .hero-body {
    font-size: clamp(0.95rem, 1.5vw, 1.05rem);
    color: #94a3b8;
    line-height: 1.7;
    max-width: 44ch;
    margin-bottom: 2.5rem;
    opacity: 0;
    animation: fadeUp 0.6s 0.7s ease both;
  }

  /* Stats row */
  .hero-stats-row {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 2.75rem;
    opacity: 0;
    animation: fadeUp 0.6s 0.9s ease both;
  }

  .hero-stat {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .hero-stat-num {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 900;
    color: white;
    letter-spacing: -1px;
    line-height: 1;
  }

  .hero-stat-label {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #7c6d8e;
  }

  .hero-stat-divider {
    width: 1px;
    height: 32px;
    background: rgba(255,255,255,0.08);
  }

  /* CTA group */
  .hero-cta-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 320px;
    width: 100%;
    opacity: 0;
    animation: fadeUp 0.6s 1.1s ease both;
  }

  .btn-hero-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0 1.75rem;
    height: 52px;
    background: white;
    color: #0a0512;
    border: none;
    border-radius: 12px;
    font-size: 0.95rem;
    font-weight: 700;
    font-family: var(--font-body);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    letter-spacing: 0.1px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    width: 100%;
    box-sizing: border-box;
  }

  .btn-hero-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(0,0,0,0.5);
  }

  .btn-hero-primary:active {
    transform: translateY(0);
  }

  .btn-guest {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0 1.75rem;
    height: 52px;
    background: linear-gradient(135deg, var(--cse-primary), var(--cse-primary-dark));
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 0.95rem;
    font-weight: 700;
    font-family: var(--font-body);
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    box-shadow: 0 4px 15px rgba(124, 58, 237, 0.25);
    width: 100%;
    box-sizing: border-box;
  }

  .btn-guest:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(124, 58, 237, 0.4);
  }

  /* Guest Mode Header Bar */
  .guest-mode-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    width: 100%;
  }

  .btn-guest-back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.88rem;
    color: #a78bfa;
    border: 1px solid rgba(167, 139, 250, 0.3);
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .btn-guest-back:hover {
    background: rgba(167, 139, 250, 0.12);
    border-color: rgba(167, 139, 250, 0.5);
    color: white;
  }

  .guest-badge {
    background: rgba(167, 139, 250, 0.12);
    border-color: rgba(167, 139, 250, 0.3);
    font-size: 0.78rem;
    white-space: nowrap;
    flex-shrink: 0;
  }

  @media (max-width: 520px) {
    .guest-cached-text {
      display: none;
    }
  }

  /* Onboarding Tooltip */
  .onboarding-tooltip {
    position: absolute;
    top: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 10, 28, 0.98);
    border: 1px solid rgba(167, 139, 250, 0.4);
    border-radius: 12px;
    padding: 1.25rem;
    max-width: 380px;
    width: calc(100% - 1rem);
    z-index: 50;
    box-shadow:
      0 20px 40px rgba(0, 0, 0, 0.6),
      0 0 30px rgba(124, 58, 237, 0.12);
  }

  .onboarding-arrow {
    position: absolute;
    top: -6px;
    left: 50%;
    transform: translateX(-50%) rotate(45deg);
    width: 12px;
    height: 12px;
    background: rgba(15, 10, 28, 0.98);
    border-left: 1px solid rgba(167, 139, 250, 0.4);
    border-top: 1px solid rgba(167, 139, 250, 0.4);
  }

  .onboarding-text {
    font-size: 0.82rem;
    color: #94a3b8;
    line-height: 1.55;
    margin: 0 0 1rem 0;
  }

  .onboarding-text strong {
    color: var(--cse-primary-light);
  }

  .btn-onboarding-dismiss {
    display: block;
    width: 100%;
    padding: 0.6rem;
    background: rgba(167, 139, 250, 0.12);
    border: 1px solid rgba(167, 139, 250, 0.3);
    border-radius: 8px;
    color: var(--cse-primary-light);
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    font-family: var(--font-body);
    transition: all 0.2s ease;
  }

  .btn-onboarding-dismiss:hover {
    background: rgba(167, 139, 250, 0.22);
    border-color: rgba(167, 139, 250, 0.5);
  }

  /* RIGHT COLUMN */
  .hero-right {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    /* padding gives room for the absolutely-positioned floating badge/pill */
    padding: 2.5rem 2rem 2rem 1rem;
    overflow: visible;
    opacity: 0;
    animation: fadeUp 0.8s 0.5s ease both;
  }

  /* Main preview card */
  .preview-card {
    background: rgba(15, 10, 28, 0.95);
    border: 1px solid rgba(124, 58, 237, 0.3);
    border-radius: 16px;
    overflow: hidden;
    width: 100%;
    max-width: 420px;
    box-shadow:
      0 30px 80px -10px rgba(0,0,0,0.8),
      0 0 60px rgba(124, 58, 237, 0.1),
      inset 0 1px 0 rgba(255,255,255,0.04);
    animation: float 6s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  .preview-card-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.85rem 1.25rem;
    background: rgba(255,255,255,0.02);
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  .preview-dots {
    display: flex;
    gap: 5px;
  }

  .pdot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }

  .pdot.red { background: #ff5f57; }
  .pdot.yellow { background: #ffbd2e; }
  .pdot.green { background: #28c840; }

  .preview-card-title {
    font-size: 0.68rem;
    color: #4a4060;
    font-weight: 600;
    letter-spacing: 0.3px;
    margin-left: auto;
  }

  .preview-progress-bar {
    height: 3px;
    background: rgba(255,255,255,0.05);
  }

  .preview-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--cse-primary), var(--cse-accent));
    border-radius: 0 3px 3px 0;
  }

  .preview-question {
    padding: 1.25rem 1.25rem 1rem;
  }

  .pq-label {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #a78bfa;
    margin-bottom: 0.5rem;
  }

  .pq-text {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 900;
    color: white;
    letter-spacing: -0.5px;
    margin: 0;
  }

  .preview-choices {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0 1.25rem 1rem;
  }

  .pc {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.75rem;
    border-radius: 8px;
    font-size: 0.82rem;
    border: 1px solid transparent;
    transition: all 0.2s;
  }

  .pc-letter {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.68rem;
    font-weight: 800;
    flex-shrink: 0;
  }

  .pc-text { flex: 1; }

  .pc.correct {
    background: rgba(52, 211, 153, 0.1);
    border-color: rgba(52, 211, 153, 0.35);
    color: #34d399;
  }

  .pc.correct .pc-letter {
    background: #34d399;
    color: #022c22;
  }

  .pc-mark {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #34d399;
    white-space: nowrap;
  }

  .pc.incorrect {
    background: rgba(248, 113, 113, 0.07);
    border-color: rgba(248, 113, 113, 0.2);
    color: #f87171;
    text-decoration: line-through;
    opacity: 0.7;
  }

  .pc.incorrect .pc-letter {
    background: rgba(248, 113, 113, 0.2);
    color: #f87171;
  }

  .pc.dimmed {
    background: rgba(255,255,255,0.02);
    border-color: rgba(255,255,255,0.05);
    color: #4a4060;
  }

  .pc.dimmed .pc-letter {
    background: rgba(255,255,255,0.05);
    color: #4a4060;
  }

  .preview-explanation {
    padding: 0.9rem 1.25rem;
    margin: 0 1.25rem 1.25rem;
    background: rgba(124, 58, 237, 0.08);
    border-left: 3px solid var(--cse-primary);
    border-radius: 0 8px 8px 0;
    font-size: 0.78rem;
    color: #94a3b8;
    line-height: 1.5;
  }

  .pe-tag {
    display: block;
    font-size: 0.6rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #a78bfa;
    margin-bottom: 0.3rem;
  }

  .preview-explanation p {
    margin: 0;
  }

  .preview-explanation strong {
    color: white;
  }

  /* Floating score badge */
  .score-badge-float {
    position: absolute;
    top: 0;
    right: 0;
    animation: float-reverse 5s 1s ease-in-out infinite;
    z-index: 10;
  }

  @keyframes float-reverse {
    0%, 100% { transform: translateY(0px) rotate(-2deg); }
    50% { transform: translateY(8px) rotate(1deg); }
  }

  .score-badge-inner {
    background: rgba(15, 10, 28, 0.98);
    border: 1px solid rgba(52, 211, 153, 0.4);
    border-radius: 14px;
    padding: 0.75rem 1.1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    box-shadow:
      0 10px 30px rgba(0,0,0,0.5),
      0 0 20px rgba(52, 211, 153, 0.15);
    position: relative;
    z-index: 1;
  }

  .score-badge-num {
    font-family: var(--font-display);
    font-size: 1.6rem;
    font-weight: 900;
    color: #34d399;
    letter-spacing: -1px;
    line-height: 1;
  }

  .score-badge-label {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #4a6060;
  }

  .score-badge-ring {
    position: absolute;
    inset: -6px;
    border-radius: 18px;
    border: 1px solid rgba(52, 211, 153, 0.15);
    pointer-events: none;
  }

  /* Floating category pill */
  .category-float {
    position: absolute;
    bottom: 0;
    left: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(15, 10, 28, 0.98);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 999px;
    padding: 0.5rem 1rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: #7c6d8e;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    animation: float-reverse 7s 0.5s ease-in-out infinite;
  }

  .cf-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--cse-primary);
    box-shadow: 0 0 6px var(--cse-primary);
  }

  /* Keyframes */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
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

  /* ---- Responsive: Tablet ---- */
  @media (max-width: 900px) {
    .hero-split {
      grid-template-columns: 1fr;
      gap: 2.5rem;
      padding: 2.5rem 1.5rem 5rem;
      min-height: auto;
    }

    .hero-right {
      order: -1;
      padding: 2rem 1.5rem 1.5rem 1rem;
    }

    .preview-card {
      max-width: 480px;
      margin: 0 auto;
    }

    .hero-title {
      font-size: clamp(2.6rem, 9vw, 3.8rem);
      letter-spacing: -2px;
    }

    .hero-body {
      max-width: 100%;
    }
  }

  /* ---- Responsive: Mobile ---- */
  @media (max-width: 600px) {
    .hero-split {
      padding: 1.5rem 1.25rem 3rem;
      gap: 1.75rem;
      min-height: auto;
    }

    .hero-right {
      display: block;
      width: 100%;
      order: 1;
      margin-top: 0.5rem;
      padding: 0;
    }

    .preview-card {
      max-width: 100%;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }

    .score-badge-float {
      display: none;
    }

    .hero-eyebrow {
      font-size: 0.65rem;
      margin-bottom: 1.25rem;
    }

    .hero-title {
      font-size: clamp(1.8rem, 9.5vw, 2.6rem);
      letter-spacing: -1px;
      margin-bottom: 1.25rem;
      gap: 0.05em;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    .hero-body {
      font-size: 0.92rem;
      margin-bottom: 2rem;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    .hero-stats-row {
      gap: 1rem;
      margin-bottom: 2rem;
      justify-content: center;
    }

    .hero-stat {
      align-items: center;
    }

    .hero-stat-num {
      font-size: 1.3rem;
    }

    .hero-stat-label {
      font-size: 0.6rem;
    }

    .hero-cta-group {
      align-items: center;
    }

    .btn-hero-primary {
      width: 100%;
      justify-content: center;
      padding: 1rem 1.5rem;
      font-size: 1rem;
      border-radius: 14px;
    }
  }

  /* ---- Responsive: Small phones ---- */
  @media (max-width: 400px) {
    .hero-split {
      padding: 1.5rem 1rem 3.5rem;
    }

    .hero-title {
      font-size: clamp(1.6rem, 8.5vw, 2.2rem);
      letter-spacing: -0.5px;
    }

    .hero-stats-row {
      gap: 0.75rem;
    }

    .hero-stat-num {
      font-size: 1.1rem;
    }
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
