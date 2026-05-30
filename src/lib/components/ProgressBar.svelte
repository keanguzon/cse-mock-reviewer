<script lang="ts">
  let { current, total, score, isPractice } = $props<{
    current: number;
    total: number;
    score: number;
    isPractice: boolean;
  }>();

  let percentage = $derived(total > 0 ? (current / total) * 100 : 0);
</script>

<div class="progress-wrapper fade-in">
  <div class="meta">
    <span class="count">{current} / {total} completed</span>
    {#if isPractice}
      <span class="score">Score: {score}</span>
    {:else}
      <span class="mode-badge">
        <span class="pulse"></span>
        Exam Mode Active
      </span>
    {/if}
  </div>
  
  <div class="track">
    <div class="bar" style="width: {percentage}%"></div>
  </div>
</div>

<style>
  .progress-wrapper {
    margin-bottom: var(--size-7);
  }

  .meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--size-2);
    font-size: var(--font-size-0);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--gray-6);
  }

  .track {
    width: 100%;
    height: 6px;
    background: var(--gray-2);
    border-radius: var(--radius-round);
    overflow: hidden;
  }

  :global([data-theme="dark"]) .track {
    background: var(--gray-8);
  }

  .bar {
    height: 100%;
    background: var(--primary);
    transition: width 0.5s var(--ease-out-4);
  }

  .mode-badge {
    color: var(--orange-6);
    display: flex;
    align-items: center;
    gap: var(--size-2);
  }

  .pulse {
    width: 8px;
    height: 8px;
    background: var(--orange-5);
    border-radius: 50%;
    animation: pulse-anim 1.5s infinite;
  }

  @keyframes pulse-anim {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(var(--orange-5-hsl), 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(var(--orange-5-hsl), 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(var(--orange-5-hsl), 0); }
  }
</style>
