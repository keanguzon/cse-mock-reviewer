<script lang="ts">
  import { page, navigating } from '$app/state';
  import { onMount } from 'svelte';
  import { adminLoading, adminQueryClient, adminRefreshError, getAdminCsrfToken, hasAdminPageCache, revalidateAdminQueries, setAdminCacheScope } from '$lib/admin/client';
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import LoadingScreen from '$lib/components/admin/LoadingScreen.svelte';
  let { children, data } = $props();
  function prepareLogout(event: SubmitEvent) {
    const csrf = (event.currentTarget as HTMLFormElement).elements.namedItem('csrf');
    if (csrf instanceof HTMLInputElement) csrf.value = getAdminCsrfToken();
    setAdminCacheScope('');
  }
  let coldNavigation = $derived(Boolean(navigating.to?.url.pathname.startsWith('/admin') && navigating.to.url.pathname !== '/admin/login' && !hasAdminPageCache(navigating.to.url.pathname)));
  $effect.pre(() => { setAdminCacheScope(page.url.pathname === '/admin/login' ? '' : data.cacheScope ?? ''); });
  onMount(() => {
    const restore = (event: PageTransitionEvent) => { if (event.persisted) { setAdminCacheScope(''); window.location.reload(); } };
    const refresh = () => { void revalidateAdminQueries(); };
    window.addEventListener('pageshow', restore);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => { window.removeEventListener('pageshow', restore); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); setAdminCacheScope(''); };
  });
</script>
<svelte:head><title>Administration | CSE Reviewer</title><meta name="robots" content="noindex,nofollow" /></svelte:head>
<div class="admin-shell">
  <header class="admin-header"><a href="/admin" class="admin-brand"><span class="navbar-brand-text">CSE Reviewer</span><span class="admin-brand-label">Administration</span></a>
    {#if page.url.pathname !== '/admin/login'}<nav aria-label="Administration"><a href="/admin" aria-current={page.url.pathname === '/admin' ? 'page' : undefined}>Overview</a><a href="/admin/users" aria-current={page.url.pathname.startsWith('/admin/users') ? 'page' : undefined}>Users</a><a href="/admin/audit" aria-current={page.url.pathname === '/admin/audit' ? 'page' : undefined}>Audit</a><form method="POST" action="/admin/logout" onsubmit={prepareLogout}><input type="hidden" name="csrf" value={data.csrf ?? ''}/><button class="btn-ghost" type="submit">Log out</button></form></nav>{/if}
  </header>
  {#if $adminRefreshError}<div class="refresh-notice" role="alert"><span>{$adminRefreshError}</span><button class="btn-ghost" onclick={()=>revalidateAdminQueries()}>Retry refresh</button></div>{/if}
  <QueryClientProvider client={adminQueryClient}>{@render children()}</QueryClientProvider>
</div>
{#if $adminLoading > 0 || coldNavigation}<LoadingScreen />{/if}
<style>
  .admin-shell { max-width:1200px;min-width:0;margin:auto;padding:1.5rem;color:var(--cse-text);font-family:var(--font-body); }
  .refresh-notice { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;margin-bottom:1rem;color:var(--cse-orange);font-size:.9rem; }
  .admin-header { display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:2rem; }
  .admin-brand { color:white; }
  .admin-brand-label { display:block;font-size:.8rem;color:var(--cse-primary-light);font-weight:500; }
  .admin-header nav { display:flex;gap:.5rem;align-items:center;flex-wrap:wrap; }
  .admin-header nav > a { color:#c0b3d0;padding:.65rem .85rem;border-radius:var(--cse-radius-sm);font-size:.85rem;font-weight:600;transition:var(--cse-transition); }
  .admin-header nav > a:hover { background:rgba(255,255,255,.05);color:white; }
  .admin-header nav > a[aria-current=page] { color:var(--cse-primary-light);background:rgba(124,58,237,.15); }
  .admin-shell :global(.admin-card) { background:var(--cse-surface);border:1px solid var(--cse-border);border-radius:var(--cse-radius);padding:2rem;margin-bottom:1.25rem;box-shadow:0 4px 6px -1px rgba(0,0,0,.6),0 20px 60px -10px rgba(124,58,237,.15),inset 0 1px 0 rgba(255,255,255,.04); }
  .admin-shell :global(h1) { font-family:var(--font-display);font-size:1.6rem;font-weight:800;letter-spacing:-.5px;margin-bottom:1rem;color:white; }
  .admin-shell :global(h2) { font-family:var(--font-display);font-size:1.15rem;font-weight:700;margin-bottom:1rem;color:white;overflow-wrap:anywhere; }
  .admin-shell :global(.toolbar) { display:flex;align-items:end;gap:.75rem;flex-wrap:wrap;margin-bottom:1rem; }
  .admin-shell :global(.toolbar label:not(.check-label)) { display:flex;flex-direction:column;gap:.4rem;min-width:0; }
  .admin-shell :global(input:not([type=checkbox]):not([type=hidden])),.admin-shell :global(select) { background:rgba(255,255,255,.06);color:var(--cse-text);border:1px solid var(--cse-border);border-radius:var(--cse-radius-sm);padding:.75rem;max-width:100%;min-height:44px;transition:var(--cse-transition); }
  .admin-shell :global(input::placeholder) { color:#c0b3d0; }
  .admin-shell :global(select option) { background:#1e1432;color:var(--cse-text); }
  .admin-shell :global(label) { color:var(--cse-text);font-size:.85rem;font-weight:600; }
  .admin-shell :global(.label) { color:var(--cse-text) !important; }
  .admin-shell :global(input[type=date]) { color-scheme:dark; }
  .admin-shell :global(.btn-primary),.admin-shell :global(.btn-ghost),.admin-shell :global(.danger) { display:inline-flex;justify-content:center;align-items:center;text-align:center;min-height:44px;line-height:1.4;white-space:normal; }
  .admin-shell :global(.btn-ghost) { color:#c0b3d0; }
  .admin-shell :global(.btn-ghost:hover) { color:white; }
  .admin-shell :global(.btn-primary:hover) { background:linear-gradient(135deg,var(--cse-primary),var(--cse-primary-dark)); }
  .admin-shell :global(.table-scroll) { max-width:100%;overflow-x:auto; }
  .admin-shell :global(table) { width:100%;border-collapse:collapse;color:inherit; }
  .admin-shell :global(th),.admin-shell :global(td) { padding:1rem;text-align:left;border-bottom:1px solid var(--cse-border);vertical-align:middle; }
  .admin-shell :global(th) { color:var(--cse-primary-light);font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;background:rgba(255,255,255,.02); }
  .admin-shell :global(td small) { color:#c0b3d0; }
  .admin-shell :global(tbody tr:hover) { background:rgba(255,255,255,.02); }
  .admin-shell :global(.muted) { color:#c0b3d0;overflow-wrap:anywhere; }
  .admin-shell :global(.error) { color:var(--cse-red);margin:.75rem 0; }
  .admin-shell :global(.success) { color:var(--cse-green);margin:.75rem 0; }
  .admin-shell :global(.danger) { background:linear-gradient(135deg,#dc2626,#b91c1c);color:white;border:0;border-radius:var(--cse-radius-sm);padding:.75rem 1.5rem;font-size:.9rem;font-weight:700;letter-spacing:.5px;cursor:pointer;transition:var(--cse-transition);box-shadow:0 4px 15px rgba(239,68,68,.3); }
  .admin-shell :global(.danger:hover:not(:disabled)) { transform:translateY(-2px);box-shadow:0 8px 25px rgba(239,68,68,.45); }
  .admin-shell :global(.danger:active:not(:disabled)) { transform:translateY(0); }
  .admin-shell :global(button:disabled) { opacity:.5;cursor:not-allowed;transform:none; }
  .admin-shell :global(:focus-visible) { outline:3px solid var(--cse-primary-light);outline-offset:3px; }
  .admin-shell :global(.pagination) { display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-top:1rem; }
  .admin-shell :global(.check-label) { display:inline-flex;align-items:center;gap:.5rem;min-height:44px;cursor:pointer; }
  .admin-shell :global(input[type=checkbox]) { width:20px;height:20px;flex-shrink:0;accent-color:var(--cse-primary-light); }
  .admin-shell :global(.stats) { display:flex;gap:2rem;flex-wrap:wrap;margin:1rem 0; }
  .admin-shell :global(.stats strong) { display:block;font-family:var(--font-display);font-size:1.7rem;font-weight:800;color:white;font-variant-numeric:tabular-nums; }
  @media(max-width:600px) {
    .admin-shell { padding:1rem; }
    .admin-header nav { gap:.25rem; }
    .admin-header nav > a { padding:.65rem; }
    .admin-shell :global(.admin-card) { padding:1.25rem; }
    .admin-shell :global(form.toolbar label:not(.check-label)) { flex:1 1 140px; }
    .admin-shell :global(form.toolbar input),.admin-shell :global(form.toolbar select) { width:100%; }
    .admin-shell :global(th),.admin-shell :global(td) { padding:.65rem; }
    .admin-shell :global(.stats) { gap:1rem 1.5rem; }
  }
  @media(prefers-reduced-motion:reduce) { .admin-shell :global(.danger),.admin-header nav > a { transition:none; } }
</style>
