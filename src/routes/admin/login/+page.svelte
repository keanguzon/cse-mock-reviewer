<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageProps } from './$types';
  let { data, form }: PageProps = $props();
  let busy = $state(false);
</script>

<svelte:head><title>Administrator sign in · CSE Reviewer</title></svelte:head>

<section class="admin-signin" aria-labelledby="signin-title">
  <div class="glass-card signin-card">
    <p class="signin-label">CSE Reviewer administration</p>
    <h1 id="signin-title" class="title is-3">Sign in</h1>
    <p class="signin-description">Use your administrator email and password.</p>
    <form method="POST" use:enhance={() => {
      busy = true;
      return async ({ update }) => { try { await update(); } finally { busy = false; } };
    }}>
      <input type="hidden" name="csrf" value={form?.csrf ?? data.csrf} />
      <div class="field">
        <label class="label" for="admin-email">Email</label>
        <div class="control"><input id="admin-email" class="input" name="email" type="email" autocomplete="username" maxlength="254" required disabled={busy} /></div>
      </div>
      <div class="field">
        <label class="label" for="admin-password">Password</label>
        <div class="control"><input id="admin-password" class="input" name="password" type="password" autocomplete="current-password" maxlength="1024" required disabled={busy} /></div>
      </div>
      <div class="signin-status" aria-live="polite">{#if form?.message}<p role="alert">{form.message}</p>{/if}</div>
      <button class="btn-primary signin-submit" aria-busy={busy} disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
    <a class="reviewer-link" href="/">Return to reviewer</a>
  </div>
</section>

<style>
  .admin-signin { min-height: 70vh; display: grid; place-items: center; padding: 2rem 1rem; }
  .signin-card { width: 100%; max-width: 28rem; }
  .signin-label { color: #c7b8df; font-size: .875rem; margin-bottom: 1rem; }
  .signin-description { color: #c7b8df; margin-bottom: 1.75rem; }
  .signin-status { min-height: 2rem; color: #fca5a5; margin-top: .75rem; }
  .signin-submit { width: 100%; }
  .reviewer-link { display: inline-block; margin-top: 1.5rem; color: #c4b5fd; }
  :is(input, button, a):focus-visible { outline: 2px solid #e9d5ff; outline-offset: 3px; }
  @media (max-width: 30rem) { .signin-card { padding: 1.5rem; } }
</style>
