<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { initAuthListener, userSession } from '$lib/userSession.svelte';
  import AuthButton from '$lib/components/AuthButton.svelte';
  import { BookOpen } from 'lucide-svelte';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { reviewerData } from '$lib/reviewerData.svelte';

  const { children } = $props();

  let isAdmin = $derived(page.url.pathname === '/admin' || page.url.pathname.startsWith('/admin/'));
  $effect(() => {
    if (!browser || isAdmin) return;
    const subscription = initAuthListener();
    const stop = reviewerData.start();
    return () => {
      subscription.unsubscribe();
      stop();
    };
  });
</script>

<svelte:head>
  <meta name="description" content="Practice for the Philippine Civil Service Exam with intelligent mock exams, real-time feedback, and performance tracking.">
  <title>CSE Reviewer – Civil Service Mock Exam</title>
</svelte:head>

{#if !isAdmin}
<nav class="navbar cse-navbar" role="navigation" aria-label="main navigation">
  <div class="container">
    <div class="navbar-brand">
      <a href="/" class="navbar-item" style="display: flex; align-items: center;">
        <BookOpen size={22} color="#9b36f4" strokeWidth={3} style="margin-right: 0.6rem; filter: drop-shadow(0 0 5px rgba(155,54,244,0.4));" />
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
{/if}

<main style="position: relative; min-height: calc(100vh - 70px);">
  {@render children()}
</main>

<style>
  :global(body) {
    background: #0a0512;
  }
</style>
