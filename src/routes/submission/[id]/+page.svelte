<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { userSession } from '$lib/userSession.svelte';
  import { goto } from '$app/navigation';
  import { ArrowLeft, Calendar, Award, GraduationCap, Clock, FileText, BarChart2, X } from 'lucide-svelte';

  type Question = {
    id: string;
    question: string;
    choices: string[];
    correct_answer: string;
    explanation?: string;
    category: string;
  };

  interface Attempt {
    id: string;
    score: number;
    total: number;
    category: string;
    mode: string;
    level?: string;
    completed_at: string;
    questions?: Question[];
    user_answers?: Record<number, string>;
  }

  let { data } = $props<{ data: { id: string } }>();
  let attemptId = $derived(data.id);

  let attempt = $state<Attempt | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let showAnalyticsModal = $state(false);

  onMount(async () => {
    const checkSession = () => {
      if (!userSession.loading) {
        fetchAttempt();
      } else {
        setTimeout(checkSession, 50);
      }
    };
    checkSession();
  });

  async function fetchAttempt() {
    if (!userSession.user) {
      error = "Please sign in to view this submission.";
      loading = false;
      return;
    }

    try {
      const { data: dbData, error: dbError } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('id', attemptId)
        .eq('user_id', userSession.user.id)
        .single();

      if (dbError) throw dbError;
      if (!dbData) {
        error = "Submission not found.";
      } else {
        attempt = {
          ...dbData,
          questions: dbData.questions || [],
          user_answers: dbData.user_answers || {}
        };
      }
    } catch (err: any) {
      console.error("Error fetching attempt:", err);
      error = "Failed to load submission details.";
    } finally {
      loading = false;
    }
  }

  let percentage = $derived(attempt && attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0);
  
  let gradeClass = $derived.by(() => {
    if (percentage >= 80) return 'text-emerald';
    if (percentage >= 60) return 'text-amber';
    return 'text-red';
  });

  function getLevelLabel(lvl?: string, categoryStr?: string): { label: string; cls: string } {
      const normalized = (lvl || '').toLowerCase();
      if (normalized === 'subprofessional') return { label: 'Sub-Professional', cls: 'badge-sub' };
      if (normalized === 'professional') return { label: 'Professional', cls: 'badge-pro' };
      
      const lower = (categoryStr || '').toLowerCase();
      if (lower.includes('clerical')) return { label: 'Sub-Professional', cls: 'badge-sub' };
      return { label: 'Professional', cls: 'badge-pro' };
  }

  function formatDate(dateStr: string) {
      return new Date(dateStr).toLocaleDateString('en-PH', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
      });
  }

  function formatMode(mode: string) {
      return mode === 'mock' ? '⏱️ Mock Exam' : '📚 Practice';
  }
  let categoryBreakdown = $derived.by(() => {
    const questions = attempt?.questions;
    const userAnswers = attempt?.user_answers;
    if (!questions || questions.length === 0 || !userAnswers) return [];
    const map = new Map<string, { correct: number; total: number }>();
    questions.forEach((q: any, idx: number) => {
      const cat = q.category || 'General';
      if (!map.has(cat)) map.set(cat, { correct: 0, total: 0 });
      const entry = map.get(cat)!;
      entry.total++;
      if (userAnswers[idx] === q.correct_answer) entry.correct++;
    });
    const results: any[] = [];
    map.forEach((val, cat) => {
      const pct = Math.round((val.correct / val.total) * 100);
      results.push({
        category: cat,
        correct: val.correct,
        total: val.total,
        percentage: pct,
        status: pct >= 90 ? 'strong' : pct >= 80 ? 'passing' : 'weak',
      });
    });
    results.sort((a, b) => b.percentage - a.percentage);
    return results;
  });

  let strongAreas = $derived(categoryBreakdown.filter(c => c.status === 'strong'));
  let weakAreas = $derived(categoryBreakdown.filter(c => c.status === 'weak'));
</script>

<div class="page-overlay" style="position: relative; z-index: 1;">
  <div class="result-container fade-in">
    {#if loading}
      <div class="glass-card text-center" style="max-width: 600px; margin: 4rem auto;">
        <progress class="progress" max="100" style="max-width: 200px; margin: 0 auto;"></progress>
        <p style="color: #7c6d8e; margin-top: 1rem; font-size: 0.95rem;">Retrieving submission answers...</p>
      </div>
    {:else if error}
      <div class="glass-card text-center" style="max-width: 600px; margin: 4rem auto;">
        <span style="font-size: 2.5rem; display: block; margin-bottom: 1rem;">⚠️</span>
        <h2 style="font-family: var(--font-display); font-size: 1.5rem; margin-bottom: 0.5rem; color: white;">An Error Occurred</h2>
        <p style="color: var(--cse-text-muted); margin-bottom: 2rem; font-size: 1rem;">{error}</p>
        <button onclick={() => goto('/')} class="btn-primary" style="padding: 0.75rem 2rem;">Return to Dashboard</button>
      </div>
    {:else if attempt}
      {@const level = getLevelLabel(attempt.level, attempt.category)}
      {@const questions = attempt.questions || []}
      {@const userAnswers = attempt.user_answers || {}}

      <div class="review-card slide-up">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
          <button class="btn-back" onclick={() => goto('/')} style="display: inline-flex; align-items: center; gap: 0.5rem; margin: 0;">
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>
          
          {#if categoryBreakdown.length > 0}
            <button class="btn-primary" onclick={() => showAnalyticsModal = true} style="padding: 0.6rem 1.25rem; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">
              <BarChart2 size={16} /> View Analytics
            </button>
          {/if}
        </div>

        <header class="review-header" style="margin-top: 0;">
          <div class="review-meta-container">
            <div class="review-meta">
              <h2 class="submission-title">{attempt.category === 'all' || attempt.category === '' ? 'Mixed Categories' : attempt.category}</h2>
              <div class="attempt-badges">
                <span class="level-badge {level.cls}" style="display: inline-flex; align-items: center; gap: 0.3rem;">
                  {#if level.label.includes('Professional')}
                    <GraduationCap size={13} />
                  {:else}
                    <Award size={13} />
                  {/if}
                  {level.label}
                </span>
                <span class="mode-badge" style="display: inline-flex; align-items: center; gap: 0.3rem;">
                  {#if attempt.mode === 'mock'}
                    <Clock size={13} /> Mock Exam
                  {:else}
                    <FileText size={13} /> Practice
                  {/if}
                </span>
                <span class="date-badge" style="display: inline-flex; align-items: center; gap: 0.3rem;">
                  <Calendar size={13} /> {formatDate(attempt.completed_at)}
                </span>
              </div>
            </div>
            
            <div class="score-summary-block">
              <div class="score-circle-display">
                <span class="score-percent {gradeClass}">{percentage}%</span>
              </div>
              <span class="score-ratio">{attempt.score} / {attempt.total} Correct</span>
            </div>
          </div>
        </header>

        <!-- Analytics Modal moved to bottom -->

        {#if questions.length === 0}
          <div class="glass-card text-center" style="margin-bottom: 3rem;">
            <p style="color: var(--cse-text-muted);">No question details found for this submission.</p>
            <p style="font-size: 0.85rem; color: #7c6d8e; margin-top: 0.5rem;">Only exams taken after the recent updates contain stored answer history.</p>
          </div>
        {:else}
          <div class="questions-list">
            {#each questions as question, index}
              {@const userAnswer = userAnswers[index]}
              {@const isCorrect = userAnswer === question.correct_answer}
              
              <div class="review-item glass-card {isCorrect ? 'item-correct' : userAnswer ? 'item-wrong' : 'item-unanswered'}">
                <header class="review-item-header">
                  <span class="question-number">Question {index + 1} of {attempt.total}</span>
                  <span class="status-badge {isCorrect ? 'status-correct' : userAnswer ? 'status-wrong' : 'status-unanswered'}">
                    {#if isCorrect}
                      ✓ Correct
                    {:else if userAnswer}
                      ✗ Incorrect
                    {:else}
                      ⚠ Unanswered
                    {/if}
                  </span>
                </header>

                <h3 class="q-text">{@html question.question.replace(/_+/g, '<span class="blank-line"></span>')}</h3>

                <div class="choices-grid">
                  {#each question.choices as choice, i}
                    {@const isChoiceSelected = userAnswer === choice}
                    {@const isChoiceCorrect = choice === question.correct_answer}
                    
                    <div class="choice-display {isChoiceCorrect ? 'choice-correct' : isChoiceSelected ? 'choice-wrong' : 'choice-disabled'}">
                      <span class="choice-letter">{String.fromCharCode(65 + i)}</span>
                      <span class="choice-text">{choice}</span>
                      
                      {#if isChoiceCorrect}
                        <span class="choice-status correct-status">Correct Answer</span>
                      {:else if isChoiceSelected}
                        <span class="choice-status wrong-status">Your Answer</span>
                      {/if}
                    </div>
                  {/each}
                </div>

                {#if question.explanation}
                  <div class="explanation">
                    <strong>Explanation:</strong>
                    <p>{question.explanation}</p>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <footer class="review-footer">
          <button class="btn-primary" onclick={() => goto('/')} style="width: 100%; max-width: 400px; padding: 1rem; font-size: 1rem; text-transform: uppercase; letter-spacing: 1px;">
            Return to Dashboard
          </button>
        </footer>
      </div>
    {/if}
  </div>
</div>

{#if showAnalyticsModal}
  <div class="modal-overlay fade-in" onclick={() => showAnalyticsModal = false} onkeydown={(e) => e.key === 'Escape' && (showAnalyticsModal = false)} tabindex="0" role="button">
    <div class="modal-content slide-up" onclick={(e) => e.stopPropagation()} role="dialog">
      <div class="modal-header">
        <h3 style="margin: 0; font-family: var(--font-display); font-size: 1.25rem;">Analytics Overview</h3>
        <button class="btn-icon" onclick={() => showAnalyticsModal = false} aria-label="Close modal">
          <X size={20} />
        </button>
      </div>
      
      <div class="modal-body">
        <div class="category-breakdown" style="background: transparent; border: none; padding: 0; margin: 0; max-width: 100%;">
          <div style="display: flex; justify-content: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
            {#if strongAreas.length > 0}
              <div class="area-label area-strong">
                <span class="area-dot strong-dot"></span>
                Strong Areas ({strongAreas.length})
              </div>
            {/if}
            {#if weakAreas.length > 0}
              <div class="area-label area-weak">
                <span class="area-dot weak-dot"></span>
                Needs Practice ({weakAreas.length})
              </div>
            {/if}
          </div>

          <div class="breakdown-list">
            {#each categoryBreakdown as cat}
              <div class="breakdown-item">
                <div class="breakdown-info">
                  <span class="breakdown-cat">{cat.category}</span>
                  <span class="breakdown-score {cat.status}">{cat.correct}/{cat.total} ({cat.percentage}%)</span>
                </div>
                <div class="breakdown-bar-bg">
                  <div
                    class="breakdown-bar-fill {cat.status}"
                    style="width: {cat.percentage}%"
                  ></div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .page-overlay {
    min-height: 100vh;
    padding: 3rem 1.5rem 6rem;
  }

  .result-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .text-center {
    text-align: center;
  }

  .text-emerald { color: var(--cse-green); }
  .text-amber { color: var(--cse-orange); }
  .text-red { color: var(--cse-red); }

  /* ---- Review Card ---- */
  .review-card {
    text-align: left;
  }

  .review-header {
    border-bottom: 1px solid var(--cse-border);
    padding-bottom: 2rem;
    margin-bottom: 2.5rem;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--cse-text);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: var(--cse-transition);
    margin-bottom: 1.5rem;
    font-family: var(--font-body);
  }

  .btn-back:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateX(-2px);
  }

  .review-meta-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .review-meta {
    flex: 1;
    min-width: 250px;
  }

  .submission-title {
    font-family: var(--font-display);
    font-size: 1.8rem;
    font-weight: 800;
    margin: 0 0 0.75rem 0;
    color: white;
    letter-spacing: -0.5px;
    line-height: 1.2;
  }

  .attempt-badges {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .level-badge {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }

  .badge-pro {
    background: rgba(99,102,241,0.15);
    color: #a5b4fc;
    border: 1px solid rgba(99,102,241,0.3);
  }

  .badge-sub {
    background: rgba(251,191,36,0.12);
    color: var(--cse-orange);
    border: 1px solid rgba(251,191,36,0.25);
  }

  .mode-badge, .date-badge {
    display: inline-block;
    background: rgba(255, 255, 255, 0.05);
    color: #94a3b8;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 600;
    border: 1px solid rgba(255, 255, 255, 0.08);
    white-space: nowrap;
  }

  .score-summary-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.35rem;
  }

  .score-circle-display {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.5rem 1.25rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
  }

  .score-percent {
    font-size: 1.6rem;
    font-weight: 900;
    font-family: var(--font-body);
    font-variant-numeric: tabular-nums lining-nums;
    letter-spacing: -0.5px;
  }

  .score-ratio {
    font-size: 0.8rem;
    color: var(--cse-text-muted);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .questions-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 3.5rem;
  }

  .review-item {
    border-left: 5px solid transparent;
    transition: var(--cse-transition);
    padding: 1.5rem;
  }

  .review-item.item-correct {
    border-left-color: var(--cse-green);
    background: rgba(52, 211, 153, 0.02);
  }

  .review-item.item-wrong {
    border-left-color: var(--cse-red);
    background: rgba(248, 113, 113, 0.02);
  }

  .review-item.item-unanswered {
    border-left-color: #475569;
    background: rgba(255, 255, 255, 0.01);
  }

  .review-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
  }

  .question-number {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--cse-text-muted);
  }

  .status-badge {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 0.25rem 0.6rem;
    border-radius: 4px;
  }

  .status-correct {
    background: rgba(52, 211, 153, 0.15);
    color: var(--cse-green);
  }

  .status-wrong {
    background: rgba(248, 113, 113, 0.15);
    color: var(--cse-red);
  }

  .status-unanswered {
    background: rgba(255, 255, 255, 0.08);
    color: var(--cse-text-muted);
  }

  .q-text {
    font-size: 1.15rem;
    font-weight: 600;
    line-height: 1.5;
    margin-bottom: 1.75rem;
    color: white;
  }

  .choices-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .choice-display {
    display: flex;
    align-items: center;
    border: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    overflow: hidden;
    font-size: 0.92rem;
  }

  .choice-letter {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    align-self: stretch;
    background: rgba(255, 255, 255, 0.04);
    font-weight: 700;
    border-right: 1px solid rgba(255, 255, 255, 0.05);
    flex-shrink: 0;
  }

  .choice-text {
    padding: 0.75rem 1.25rem;
    flex-grow: 1;
    font-weight: 500;
    line-height: 1.4;
  }

  .choice-status {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding-right: 1rem;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* Choice States */
  .choice-correct {
    border-color: rgba(52, 211, 153, 0.4);
    background: rgba(52, 211, 153, 0.08);
    color: var(--cse-green);
  }
  .choice-correct .choice-letter {
    background: var(--cse-green);
    color: #022c22;
    border-right-color: rgba(52, 211, 153, 0.4);
  }
  .correct-status {
    color: var(--cse-green);
  }

  .choice-wrong {
    border-color: rgba(248, 113, 113, 0.4);
    background: rgba(248, 113, 113, 0.08);
    color: var(--cse-red);
  }
  .choice-wrong .choice-letter {
    background: var(--cse-red);
    color: #450a0a;
    border-right-color: rgba(248, 113, 113, 0.4);
  }
  .wrong-status {
    color: var(--cse-red);
  }

  .choice-disabled {
    opacity: 0.5;
  }
  
  /* Benchmark & Breakdown Styling */
  .category-breakdown {
    max-width: 500px;
    margin: 0 auto 3rem;
    text-align: left;
    background: rgba(255, 255, 255, 0.02);
    padding: 1.25rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .breakdown-title {
    font-family: var(--font-display);
    font-size: 0.8rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--cse-text-muted);
    margin-bottom: 0.75rem;
    text-align: center;
  }

  .area-label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .area-strong { color: var(--cse-green); }
  .area-weak { color: var(--cse-orange); }

  .area-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }
  .strong-dot { background: var(--cse-green); box-shadow: 0 0 6px var(--cse-green); }
  .weak-dot { background: var(--cse-orange); box-shadow: 0 0 6px var(--cse-orange); }

  .breakdown-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .breakdown-item {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .breakdown-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .breakdown-cat {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--cse-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 70%;
  }

  .breakdown-score {
    font-size: 0.72rem;
    font-weight: 800;
    font-family: var(--font-body);
    font-variant-numeric: tabular-nums lining-nums;
  }
  .breakdown-score.strong { color: var(--cse-green); }
  .breakdown-score.passing { color: #a5b4fc; }
  .breakdown-score.weak { color: var(--cse-orange); }

  .breakdown-bar-bg {
    width: 100%;
    height: 5px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 999px;
    overflow: hidden;
  }

  .breakdown-bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .breakdown-bar-fill.strong {
    background: linear-gradient(90deg, var(--cse-green), #6ee7b7);
  }
  .breakdown-bar-fill.passing {
    background: linear-gradient(90deg, var(--cse-primary), var(--cse-primary-light));
  }
  .breakdown-bar-fill.weak {
    background: linear-gradient(90deg, var(--cse-orange), #fde68a);
  }

  .explanation {
    padding: 1rem 1.25rem;
    background: rgba(255, 255, 255, 0.02);
    border-left: 3px solid var(--cse-primary);
    border-radius: 0 8px 8px 0;
    font-size: 0.88rem;
    line-height: 1.55;
    color: var(--cse-text);
  }

  .explanation strong {
    color: var(--cse-primary-light);
    display: block;
    margin-bottom: 0.25rem;
  }

  .review-footer {
    display: flex;
    justify-content: center;
    border-top: 1px solid var(--cse-border);
    padding-top: 2.5rem;
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    backdrop-filter: blur(8px);
  }

  .modal-content {
    background: #171923;
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 16px;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .btn-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--cse-text-muted);
    cursor: pointer;
    border-radius: 8px;
    padding: 0.4rem;
    transition: var(--cse-transition);
  }

  .btn-icon:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  :global(.blank-line) {
    display: inline-block;
    width: 80px;
    border-bottom: 2px solid rgba(255,255,255,0.4);
    margin: 0 2px;
    vertical-align: bottom;
  }

  @media (max-width: 600px) {
    .page-overlay { padding: 1.5rem 1rem 3rem; }
    .submission-title { font-size: 1.4rem; }
    .review-meta-container { flex-direction: column; align-items: flex-start; gap: 1rem; }
    .score-summary-block { width: 100%; flex-direction: row; justify-content: space-between; align-items: center; }
    .review-item { padding: 1rem; }
    .q-text { font-size: 1rem; margin-bottom: 1.2rem; }
    .choice-text { padding: 0.6rem 0.8rem; font-size: 0.85rem; }
    .review-item-header { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
    .score-circle-display { padding: 0.4rem 1rem; }
    .score-percent { font-size: 1.2rem; }
  }
</style>
