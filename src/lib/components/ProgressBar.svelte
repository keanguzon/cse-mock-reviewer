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
    margin-bottom: 2.5rem;
    padding-top: 1.5rem; /* Space from navbar */
  }

  .meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.8rem;
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--cse-text-muted);
    font-family: var(--font-body);
  }

  .track {
    width: 100%;
    height: 8px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    overflow: hidden;
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.5);
  }

  .bar {
    height: 100%;
    background: linear-gradient(90deg, var(--cse-primary), var(--cse-accent));
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 10px rgba(232, 121, 249, 0.4);
  }

  .mode-badge {
    color: var(--cse-orange);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .pulse {
    width: 8px;
    height: 8px;
    background: var(--cse-orange);
    border-radius: 50%;
    animation: pulse-anim 1.5s infinite;
  }

  @keyframes pulse-anim {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(251, 191, 36, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
  }
</style>
