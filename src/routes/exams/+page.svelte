<script lang="ts">
  import { supabase } from "$lib/supabaseClient";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { userSession } from "$lib/userSession.svelte";
  import { guestStore } from "$lib/guestStore.svelte";
  import {
    ArrowLeft,
    Calendar,
    GraduationCap,
    Award,
    Clock,
    FileText,
    ChevronLeft,
    ChevronRight
  } from "lucide-svelte";

  interface Attempt {
    id: string;
    score: number;
    total: number;
    category: string;
    mode: string;
    level?: string;
    completed_at: string;
  }

  let attempts: Attempt[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Pagination & Filtering
  let currentPage = $state(1);
  const itemsPerPage = 10;
  let filterMode = $state("all");
  let filterCategory = $state("all");

  let uniqueCategories = $derived(
    Array.from(
      new Set(
        attempts.map(a => {
          const raw = (a.category || "").trim();
          if (!raw || raw.toLowerCase() === "all" || raw.toLowerCase() === "all categories") {
            return "Mixed Categories";
          }
          return raw;
        })
      )
    ).sort((a, b) => a.localeCompare(b))
  );

  let filteredAttempts = $derived.by(() => {
    return attempts.filter(a => {
      const modeMatch = filterMode === "all" || a.mode === filterMode;
      const raw = (a.category || "").trim();
      const catVal = (!raw || raw.toLowerCase() === "all" || raw.toLowerCase() === "all categories") ? "Mixed Categories" : raw;
      const catMatch = filterCategory === "all" || catVal === filterCategory;
      return modeMatch && catMatch;
    });
  });

  let totalPages = $derived(Math.max(1, Math.ceil(filteredAttempts.length / itemsPerPage)));
  
  let paginatedAttempts = $derived.by(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAttempts.slice(start, start + itemsPerPage);
  });

  let paginationPages = $derived.by(() => {
    return getPaginationItems(currentPage, totalPages);
  });

  // Reset page when filters change
  $effect(() => {
    filterMode;
    filterCategory;
    currentPage = 1;
  });

  onMount(async () => {
    if (!userSession.user) {
      attempts = guestStore.attempts.map((att, idx) => ({
        id: (att as any).id || `guest-${idx}`,
        score: att.score,
        total: att.total,
        category: att.category,
        mode: att.mode,
        level: att.level,
        completed_at: att.completed_at || (att as any).date || new Date().toISOString(),
      }));
      loading = false;
      return;
    }

    try {
      const { data, error: dbError } = await supabase
        .from("exam_attempts")
        .select("id, score, total, category, mode, level, completed_at")
        .eq("user_id", userSession.user.id)
        .order("completed_at", { ascending: false });

      if (dbError) throw dbError;
      attempts = data || [];
    } catch (err: any) {
      console.error("Error fetching attempts:", err);
      error = "Failed to load exams.";
    } finally {
      loading = false;
    }
  });

  function getPaginationItems(current: number, total: number): (number | string)[] {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 4) {
      return [1, 2, 3, 4, 5, "...", total];
    }
    if (current >= total - 3) {
      return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
    }
    return [1, "...", current - 1, current, current + 1, "...", total];
  }

  function getLevelLabel(attempt: Attempt): { label: string; cls: string } {
    const lvl = (attempt.level || "").toLowerCase();
    if (lvl === "subprofessional") return { label: "Sub-Professional", cls: "badge-sub" };
    if (lvl === "professional") return { label: "Professional", cls: "badge-pro" };
    const lower = (attempt.category || "").toLowerCase();
    if (lower.includes("clerical")) return { label: "Sub-Professional", cls: "badge-sub" };
    return { label: "Professional", cls: "badge-pro" };
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }
</script>

<svelte:head>
  <title>All Exams | CSE Reviewer</title>
</svelte:head>

<div class="exams-page fade-in">
  <div class="top-nav-bar slide-up">
    <button class="btn-back-outside" onclick={() => goto('/')}>
      <ArrowLeft size={16} /> Back to Dashboard
    </button>
  </div>

  <!-- Minimal Top Header Bar -->
  <header class="page-header glass-card slide-up">
    <div>
      <h1 class="page-title">All Exam Attempts</h1>
      <p class="subtitle">{filteredAttempts.length} Total Exams</p>
    </div>

    <!-- Minimal Filter Controls placed on Top Right -->
    <div class="header-filters">
      <div class="filter-pill">
        <select id="mode-filter" bind:value={filterMode} class="minimal-select" aria-label="Filter Mode">
          <option value="all">All Modes</option>
          <option value="mock">Mock Exam</option>
          <option value="practice">Practice Mode</option>
        </select>
      </div>

      <div class="filter-pill">
        <select id="cat-filter" bind:value={filterCategory} class="minimal-select" aria-label="Filter Category">
          <option value="all">All Categories</option>
          {#each uniqueCategories as cat}
            <option value={cat}>{cat}</option>
          {/each}
        </select>
      </div>
    </div>
  </header>

  <div class="main-content slide-up" style="animation-delay: 0.1s;">
    {#if loading}
      <div class="loading-state glass-card">
        <progress class="progress" max="100"></progress>
        <p>Loading your exams...</p>
      </div>
    {:else if error}
      <div class="glass-card error-state">
        <p class="error-text">{error}</p>
        <button class="btn-primary" onclick={() => goto('/')}>Return to Dashboard</button>
      </div>
    {:else if filteredAttempts.length === 0}
      <div class="empty-state glass-card">
        <p>No exams match your selected filters.</p>
        <button class="btn-ghost" onclick={() => { filterMode = 'all'; filterCategory = 'all'; }}>
          Clear Filters
        </button>
      </div>
    {:else}
      <div class="exams-card glass-card slide-up">
        <div class="activity-list">
          {#each paginatedAttempts as attempt}
            {@const pct = Math.round((attempt.score / attempt.total) * 100)}
            {@const level = getLevelLabel(attempt)}
            <div class="activity-item">
              <div class="activity-info">
                <strong>{attempt.category === "all" || attempt.category === "" ? "Mixed Categories" : attempt.category}</strong>
                <div class="activity-meta-row">
                  <span class="level-badge {level.cls}">
                    {#if level.label.includes("Professional")}
                      <GraduationCap size={13} />
                    {:else}
                      <Award size={13} />
                    {/if}
                    {level.label}
                  </span>
                  <small class="date-label">
                    <Calendar size={12} /> {formatDate(attempt.completed_at)}
                  </small>
                </div>
                <small class="mode-label">
                  {#if attempt.mode === "mock"}
                    <Clock size={12} /> Mock Exam
                  {:else}
                    <FileText size={12} /> Practice Mode
                  {/if}
                </small>
              </div>
              <div class="activity-right">
                <span class="score-badge" class:good={pct >= 75} class:needs-work={pct < 75}>
                  {attempt.score}/{attempt.total}
                </span>
                <button class="btn-view-submission" onclick={() => goto("/submission/" + attempt.id)}>
                  View Submission
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Advanced Numbered Pagination (1 2 3 ... 10) -->
      {#if totalPages > 1}
        <div class="pagination-bar glass-card">
          <button 
            class="pagination-btn" 
            disabled={currentPage === 1}
            onclick={() => currentPage--}
            aria-label="Previous Page"
          >
            <ChevronLeft size={16} /> Prev
          </button>
          
          <div class="page-numbers">
            {#each paginationPages as page}
              {#if page === "..."}
                <span class="pagination-ellipsis">...</span>
              {:else}
                <button 
                  class="page-num-btn" 
                  class:active={currentPage === page}
                  onclick={() => currentPage = Number(page)}
                >
                  {page}
                </button>
              {/if}
            {/each}
          </div>

          <button 
            class="pagination-btn" 
            disabled={currentPage === totalPages}
            onclick={() => currentPage++}
            aria-label="Next Page"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .exams-page {
    max-width: 1000px;
    margin: 1.5rem auto;
    padding: 0 1rem 4rem 1rem;
    font-family: var(--font-body);
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1.25rem;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .top-nav-bar {
    margin-bottom: 0.75rem;
  }

  .btn-back-outside {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.45rem 0.85rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--cse-primary-light);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: var(--font-body);
  }

  .btn-back-outside:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border-color: rgba(255, 255, 255, 0.2);
  }

  .page-title {
    font-family: var(--font-body);
    font-size: 1.4rem;
    font-weight: 700;
    margin: 0;
    color: white;
  }

  .subtitle {
    color: var(--cse-text-muted);
    font-size: 0.82rem;
    margin: 0;
    font-family: var(--font-body);
  }

  /* Minimal Filter Controls on Top-Right */
  .header-filters {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .filter-pill {
    position: relative;
    display: inline-block;
  }

  .minimal-select {
    background-color: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: var(--cse-primary-light);
    padding: 0.45rem 2.2rem 0.45rem 0.85rem;
    border-radius: 8px;
    font-family: var(--font-body);
    font-size: 0.82rem;
    font-weight: 600;
    outline: none;
    cursor: pointer;
    transition: all 0.2s ease;
    max-width: 220px;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23a78bfa' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
  }

  .minimal-select:hover, .minimal-select:focus {
    background-color: rgba(255, 255, 255, 0.12);
    border-color: var(--cse-primary);
  }

  .minimal-select option {
    background: #1e1b2e;
    color: white;
  }

  .loading-state, .empty-state, .error-state {
    padding: 3rem 1.5rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    font-family: var(--font-body);
  }

  .error-text {
    color: var(--cse-red);
  }

  .exams-card {
    padding: 0.75rem 1.25rem;
    margin-bottom: 1.5rem;
  }

  .activity-list {
    display: flex;
    flex-direction: column;
  }

  .activity-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.85rem 0.5rem;
    border-bottom: 1px dashed rgba(255, 255, 255, 0.08);
    transition: background 0.2s ease;
  }

  .activity-item:last-child {
    border-bottom: none;
  }

  .activity-item:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .activity-info {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-family: var(--font-body);
  }

  .activity-info strong {
    font-size: 1.05rem;
    color: white;
    font-family: var(--font-body);
  }

  .activity-meta-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    flex-wrap: wrap;
  }

  .level-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.55rem;
    border-radius: 4px;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-family: var(--font-body);
  }

  .badge-sub {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
  }

  .badge-pro {
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
  }

  .date-label, .mode-label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--cse-text-muted);
    font-size: 0.82rem;
    font-family: var(--font-body);
  }

  .activity-right {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .score-badge {
    font-family: var(--font-body);
    font-weight: 800;
    font-size: 1.15rem;
    padding: 0.4rem 0.85rem;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    font-variant-numeric: tabular-nums lining-nums;
  }

  .score-badge.good {
    color: #34d399;
    background: rgba(16, 185, 129, 0.1);
  }

  .score-badge.needs-work {
    color: #fbbf24;
    background: rgba(251, 191, 36, 0.1);
  }

  .btn-view-submission {
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(167, 139, 250, 0.3);
    color: var(--cse-primary-light, #c4b5fd);
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    font-family: var(--font-body);
  }

  .btn-view-submission:hover {
    background: rgba(139, 92, 246, 0.25);
    border-color: rgba(167, 139, 250, 0.6);
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.2);
  }

  /* Numbered Pagination Styling */
  .pagination-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.85rem 1.25rem;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .page-numbers {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .page-num-btn {
    min-width: 34px;
    height: 34px;
    padding: 0 0.5rem;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--cse-text-muted);
    font-family: var(--font-body);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .page-num-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }

  .page-num-btn.active {
    background: var(--cse-primary);
    border-color: var(--cse-primary-light);
    color: white;
    font-weight: 700;
  }

  .pagination-ellipsis {
    color: var(--cse-text-muted);
    padding: 0 0.25rem;
    font-weight: 700;
    user-select: none;
  }

  .pagination-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: white;
    padding: 0.45rem 0.85rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: var(--font-body);
  }

  .pagination-btn:not(:disabled):hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .pagination-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Mobile Responsive Tweaks */
  @media (max-width: 640px) {
    .page-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .header-filters {
      width: 100%;
      justify-content: flex-start;
    }

    .minimal-select {
      flex: 1;
      width: 100%;
    }

    .activity-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.85rem;
    }
    
    .activity-right {
      width: 100%;
      justify-content: space-between;
    }

    .pagination-bar {
      justify-content: center;
    }
  }
</style>
