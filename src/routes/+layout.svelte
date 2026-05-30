<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { initAuthListener, userSession } from '$lib/userSession.svelte';
  import AuthButton from '$lib/components/AuthButton.svelte';

  const { children } = $props();

  onMount(() => {
    const subscription = initAuthListener();
    return () => {
      subscription.unsubscribe();
    };
  });
</script>

<svelte:head>
  <meta name="description" content="Practice for the Philippine Civil Service Exam with intelligent mock exams, real-time feedback, and performance tracking.">
  <title>CSE Reviewer – Civil Service Mock Exam</title>
</svelte:head>

<nav class="navbar cse-navbar" role="navigation" aria-label="main navigation">
  <div class="container">
    <div class="navbar-brand">
      <a href="/" class="navbar-item" style="display: flex; align-items: center;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9b36f4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 0.6rem; filter: drop-shadow(0 0 5px rgba(155,54,244,0.4));">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
        <span class="gradient-text navbar-brand-text">CSE Reviewer</span>
      </a>
    </div>
    <div class="navbar-end">
      <div class="navbar-item">
        <AuthButton user={userSession.user} />
      </div>
    </div>
  </div>
</nav>

<main style="position: relative; min-height: 100vh;">
  {@render children()}
</main>

<style>
  :global(body) {
    background: #0f1117;
  }
</style>
