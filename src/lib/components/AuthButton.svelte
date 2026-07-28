<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import type { User } from '@supabase/supabase-js';
  import { page } from '$app/stores';
  import { LogOut, ChevronDown } from 'lucide-svelte';

  let { user = null }: { user: User | null } = $props();
  let isQuizPage = $derived($page.url.pathname.startsWith('/quiz'));

  let showDropdown = $state(false);

  function toggleDropdown() {
    showDropdown = !showDropdown;
  }

  function closeDropdown() {
    showDropdown = false;
  }

  async function signOut() {
    showDropdown = false;
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Error logging out:", error.message);
  }
</script>

{#if user}
  <div class="user-menu-container">
    <button class="user-pill-btn" onclick={toggleDropdown} aria-expanded={showDropdown} aria-label="User menu">
      <img
        src={user.user_metadata.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'}
        alt="avatar"
        class="avatar"
      />
      <span class="user-name hidden-mobile" class:hidden-quiz={isQuizPage}>
        {user.user_metadata.full_name?.split(' ')[0] || user.user_metadata.name?.split(' ')[0] || 'Account'}
      </span>
      <ChevronDown size={13} class="chevron-icon" />
    </button>

    {#if showDropdown}
      <div 
        class="dropdown-backdrop" 
        onclick={closeDropdown}
        onkeydown={(e) => e.key === 'Escape' && closeDropdown()}
        role="button"
        tabindex="0"
        aria-label="Close menu"
      ></div>

      <div class="user-dropdown-menu slide-up" role="menu">
        <div class="menu-header">
          <img
            src={user.user_metadata.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'}
            alt="avatar"
            class="menu-avatar"
          />
          <div class="menu-user-info">
            <span class="menu-name">{user.user_metadata.full_name || user.user_metadata.name || 'User'}</span>
            <span class="menu-email">{user.email || ''}</span>
          </div>
        </div>

        <div class="menu-divider"></div>

        {#if !isQuizPage}
          <button class="menu-item menu-item-danger" onclick={signOut}>
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .user-menu-container {
    position: relative;
    display: inline-block;
  }

  .user-pill-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(167, 139, 250, 0.25);
    border-radius: 999px;
    padding: 0.25rem 0.6rem 0.25rem 0.25rem;
    cursor: pointer;
    transition: all 0.2s ease;
    color: white;
    box-sizing: border-box;
  }

  .user-pill-btn:hover {
    background: rgba(167, 139, 250, 0.12);
    border-color: rgba(167, 139, 250, 0.45);
  }

  .avatar {
    width: 28px;
    height: 28px;
    min-width: 28px;
    min-height: 28px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    aspect-ratio: 1 / 1;
    background: #1e2030;
    display: block;
  }

  .user-name {
    font-size: 0.82rem;
    font-weight: 600;
    color: #f1f5f9;
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-name.hidden-quiz {
    display: none;
  }

  .chevron-icon {
    color: #a78bfa;
    flex-shrink: 0;
    transition: transform 0.2s ease;
  }

  /* Backdrop for closing click */
  .dropdown-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: transparent;
  }

  /* Floating Menu */
  .user-dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 240px;
    background: #130d22;
    border: 1px solid rgba(167, 139, 250, 0.3);
    border-radius: 14px;
    padding: 0.75rem;
    z-index: 101;
    box-shadow:
      0 15px 35px rgba(0, 0, 0, 0.6),
      0 0 25px rgba(124, 58, 237, 0.15);
  }

  .menu-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.25rem;
  }

  .menu-avatar {
    width: 40px;
    height: 40px;
    min-width: 40px;
    min-height: 40px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    aspect-ratio: 1 / 1;
    display: block;
    background: #1e2030;
  }

  .menu-user-info {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex: 1;
  }

  .menu-name {
    font-size: 0.85rem;
    font-weight: 700;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .menu-email {
    font-size: 0.72rem;
    color: #7c6d8e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .menu-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0.6rem 0;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    width: 100%;
    padding: 0.55rem 0.75rem;
    border-radius: 8px;
    border: none;
    background: transparent;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: var(--font-body);
  }

  .menu-item-danger {
    color: #f87171;
  }

  .menu-item-danger:hover {
    background: rgba(248, 113, 113, 0.12);
    color: #fca5a5;
  }

  @media (max-width: 600px) {
    .hidden-mobile {
      display: none;
    }
    .user-pill-btn {
      padding: 0.25rem 0.45rem 0.25rem 0.25rem;
      gap: 0.25rem;
    }
  }
</style>
