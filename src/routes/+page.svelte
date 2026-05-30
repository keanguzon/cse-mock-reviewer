<script lang="ts">
  import { goto } from '$app/navigation';
  
  let selectedMode = $state('practice');
  let selectedCategory = $state('');

  function startQuiz() {
    let url = `/quiz?mode=${selectedMode}`;
    if (selectedCategory) url += `&category=${encodeURIComponent(selectedCategory)}`;
    goto(url);
  }
</script>

<div class="hero-section text-center fade-in">
  <h1 class="gradient-text">Civil Service Exam Reviewer</h1>
  <p class="subtitle">Master the material with intelligent mock exams and detailed explanations.</p>
</div>

<div class="config-panel glass-panel slide-up" style="animation-delay: 0.1s; max-width: 600px; margin: 0 auto;">
  <form onsubmit={(e) => { e.preventDefault(); startQuiz(); }}>
    <fieldset>
      <legend><strong>Select Exam Mode</strong></legend>
      <div class="grid">
        <label for="practice" class="mode-card {selectedMode === 'practice' ? 'selected' : ''}">
          <input type="radio" id="practice" name="mode" value="practice" bind:group={selectedMode} class="sr-only">
          <span class="icon">📚</span>
          <h3>Practice Mode</h3>
          <p>Get immediate feedback and detailed explanations after every question.</p>
        </label>
        
        <label for="mock" class="mode-card {selectedMode === 'mock' ? 'selected' : ''}">
          <input type="radio" id="mock" name="mode" value="mock" bind:group={selectedMode} class="sr-only">
          <span class="icon">⏱️</span>
          <h3>Mock Exam</h3>
          <p>Simulate the real exam. No feedback until you finish the test.</p>
        </label>
      </div>
    </fieldset>

    <fieldset style="margin-top: var(--size-6);">
      <legend><strong>Select Category (Optional)</strong></legend>
      <select bind:value={selectedCategory}>
        <option value="">All Categories (Mixed)</option>
        <option value="Verbal Ability – Vocabulary">Verbal Ability – Vocabulary</option>
        <option value="Verbal Ability – Grammar">Verbal Ability – Grammar</option>
        <option value="Verbal Ability – Correct Usage">Verbal Ability – Correct Usage</option>
        <option value="Verbal Ability – Paragraph Organization">Verbal Ability – Paragraph Organization</option>
        <option value="Verbal Ability – Reading Comprehension">Verbal Ability – Reading Comprehension</option>
      </select>
    </fieldset>

    <button type="submit" class="start-btn">Start Session</button>
  </form>
</div>

<style>
  .hero-section {
    margin: var(--size-8) 0;
  }

  .gradient-text {
    font-size: var(--font-size-7);
    font-weight: 900;
    letter-spacing: -2px;
    background: linear-gradient(to right, var(--indigo-5), var(--violet-5));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: var(--size-3);
  }

  .subtitle {
    font-size: var(--font-size-4);
    color: var(--gray-6);
    max-width: 60ch;
    margin: 0 auto;
  }

  .text-center { text-align: center; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }

  .mode-card {
    display: block;
    padding: var(--size-4);
    border: 2px solid var(--gray-3);
    border-radius: var(--radius-3);
    cursor: pointer;
    transition: var(--transition);
    background: var(--gray-0);
  }

  :global([data-theme="dark"]) .mode-card {
    border-color: var(--gray-7);
    background: var(--gray-9);
  }

  .mode-card:hover {
    border-color: var(--primary-hover);
    transform: translateY(-2px);
  }

  .mode-card.selected {
    border-color: var(--primary);
    background: var(--indigo-0);
  }
  
  :global([data-theme="dark"]) .mode-card.selected {
    background: var(--indigo-9);
  }

  .mode-card .icon {
    font-size: var(--font-size-6);
    display: block;
    margin-bottom: var(--size-2);
  }

  .mode-card h3 {
    margin: 0 0 var(--size-1) 0;
    font-size: var(--font-size-3);
  }

  .mode-card p {
    margin: 0;
    font-size: var(--font-size-1);
    color: var(--gray-6);
  }

  .start-btn {
    width: 100%;
    margin-top: var(--size-6);
    background: var(--primary);
    color: white;
    border: none;
    font-size: var(--font-size-3);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: var(--size-3);
    border-radius: var(--radius-2);
    transition: var(--transition);
  }

  .start-btn:hover {
    background: var(--primary-hover);
    transform: translateY(-2px);
    box-shadow: var(--shadow-3);
  }
</style>
