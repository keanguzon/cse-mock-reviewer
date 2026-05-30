<script lang="ts">
  let { score, total, onExit } = $props<{
    score: number;
    total: number;
    onExit: () => void;
  }>();

  let percentage = $derived(total > 0 ? Math.round((score / total) * 100) : 0);
  
  let gradeClass = $derived.by(() => {
    if (percentage >= 80) return 'text-emerald';
    if (percentage >= 60) return 'text-amber';
    return 'text-red';
  });
</script>

<div class="result-container fade-in">
  <div class="glass-panel text-center">
    <span class="eyebrow">Exam Complete</span>
    
    <div class="score-display">
      <span class="score-number {gradeClass}">{percentage}%</span>
    </div>
    
    <p class="summary-text">
      You answered <strong>{score}</strong> out of <strong>{total}</strong> questions correctly.
    </p>

    <div class="stats-bar">
      <div class="stats-labels">
        <span>Correct ({score})</span>
        <span>Incorrect ({total - score})</span>
      </div>
      <div class="bar-bg">
        <div class="bar-fill" style="width: {percentage}%"></div>
      </div>
    </div>

    <button class="primary-btn" onclick={onExit}>Return to Dashboard</button>
  </div>
</div>

<style>
  .result-container {
    max-width: 600px;
    margin: var(--size-8) auto;
  }

  .text-center {
    text-align: center;
  }

  .eyebrow {
    font-size: var(--font-size-0);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: var(--gray-5);
    display: block;
    margin-bottom: var(--size-4);
  }

  .score-display {
    margin-bottom: var(--size-6);
  }

  .score-number {
    font-size: 6rem;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -2px;
  }

  .text-emerald { color: var(--green-6); }
  .text-amber { color: var(--orange-6); }
  .text-red { color: var(--red-6); }

  .summary-text {
    font-size: var(--font-size-3);
    color: var(--gray-7);
    margin-bottom: var(--size-8);
  }

  .stats-bar {
    max-width: 400px;
    margin: 0 auto var(--size-8);
  }

  .stats-labels {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-0);
    font-weight: 700;
    color: var(--gray-6);
    margin-bottom: var(--size-2);
    text-transform: uppercase;
  }

  .bar-bg {
    width: 100%;
    height: 12px;
    background: var(--red-2);
    border-radius: var(--radius-round);
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: var(--green-5);
    border-radius: var(--radius-round);
    transition: width 1s var(--ease-out-4);
  }

  .primary-btn {
    background: var(--primary);
    color: white;
    border: none;
    padding: var(--size-3) var(--size-6);
    font-size: var(--font-size-2);
    font-weight: 700;
    border-radius: var(--radius-2);
    cursor: pointer;
    transition: var(--transition);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .primary-btn:hover {
    background: var(--primary-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-3);
  }
</style>
