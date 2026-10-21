<script lang="ts">
  let { label = 'Processing…' }: { label?: string } = $props();
</script>

<span class="inline-loading" role="status" aria-live="polite">
  <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20"/></svg>
  <span>{label}</span>
</span>

<style>
  .inline-loading { display:inline-flex;align-items:center;gap:.5rem;color:inherit;font-size:inherit; }
  svg { width:1em;height:1em;flex-shrink:0;animation:rotate 1.8s linear infinite; }
  circle { fill:none;stroke:currentColor;stroke-width:4;stroke-linecap:round;stroke-dasharray:12 114;animation:arc 1.8s ease-in-out infinite; }
  @keyframes rotate { to { transform:rotate(360deg); } }
  @keyframes arc { 0%,100% { stroke-dasharray:12 114;stroke-dashoffset:0; } 50% { stroke-dasharray:88 38;stroke-dashoffset:-24; } 100% { stroke-dashoffset:-126; } }
  @media(prefers-reduced-motion:reduce) { svg,circle { animation:none; } circle { stroke-dasharray:88 38; } }
</style>
