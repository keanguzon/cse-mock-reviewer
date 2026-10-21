<script lang="ts">
  import { onMount } from 'svelte';
  let overlay: HTMLDivElement;
  onMount(() => { overlay.showPopover?.(); });
</script>

<div bind:this={overlay} popover="manual" class="admin-loading" role="status" aria-live="polite" aria-label="Loading administration">
  <div class="loading-content">
    <svg class="loading-ring" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20"/></svg>
    <span>Loading…</span>
  </div>
</div>

<style>
  .admin-loading { position:fixed;inset:0;z-index:2000;margin:0;padding:0;border:0;width:100%;height:100dvh;max-width:none;max-height:none;display:grid;place-items:center;background:rgba(10,5,18,.68);color:var(--cse-text);cursor:progress; }
  .loading-content { display:flex;flex-direction:column;align-items:center;gap:1rem;font-family:var(--font-body);font-size:.9rem; }
  .loading-ring { width:48px;height:48px;color:var(--cse-primary-light);animation:rotate 1.8s linear infinite; }
  circle { fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-dasharray:12 114;animation:arc 1.8s ease-in-out infinite;transform-origin:center; }
  @keyframes rotate { to { transform:rotate(360deg); } }
  @keyframes arc { 0%,100% { stroke-dasharray:12 114;stroke-dashoffset:0; } 50% { stroke-dasharray:88 38;stroke-dashoffset:-24; } 100% { stroke-dashoffset:-126; } }
  @media(prefers-reduced-motion:reduce) { .loading-ring,circle { animation:none; } circle { stroke-dasharray:88 38; } }
</style>
