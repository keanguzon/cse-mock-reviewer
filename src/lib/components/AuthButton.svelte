<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import type { User } from '@supabase/supabase-js';
  import { page } from '$app/stores';

  let { user = null }: { user: User | null } = $props();
  let isQuizPage = $derived($page.url.pathname.startsWith('/quiz'));

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`
      }
    });
    if (error) console.error("Error logging in:", error.message);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Error logging out:", error.message);
  }
</script>

{#if user}
  <div class="user-bar">
    <img
      src={user.user_metadata.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'}
      alt="avatar"
      class="avatar"
    />
    <span class="user-name">{user.user_metadata.full_name || user.user_metadata.name || user.email}</span>
    {#if !isQuizPage}
      <button class="btn-sign-out" onclick={signOut}>Sign Out</button>
    {/if}
  </div>
{/if}

<style>
  .user-bar {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(99, 102, 241, 0.2);
    border-radius: 999px;
    padding: 0.3rem 0.8rem 0.3rem 0.3rem;
  }

  .avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    object-fit: cover;
    background: #1e2030;
  }

  .user-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: #e2e8f0;
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .btn-sign-out {
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
    border-radius: 999px;
    padding: 0.2rem 0.65rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    font-family: 'Inter', sans-serif;
    transition: all 0.2s ease;
  }

  .btn-sign-out:hover {
    background: rgba(239, 68, 68, 0.1);
  }


</style>
