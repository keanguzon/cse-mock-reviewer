<script lang="ts">
    import { supabase } from "$lib/supabaseClient";
    import { onMount } from "svelte";
    import type { User } from "@supabase/supabase-js";
    import { goto } from "$app/navigation";
    import {
        Trophy,
        TrendingUp,
        ClipboardCheck,
        BookOpen,
        Calendar,
        GraduationCap,
        Award,
        Clock,
        FileText,
        ArrowRight,
        Sparkles,
        CheckCircle2,
        AlertTriangle,
        ChevronDown,
        Lock,
        Loader2,
    } from "lucide-svelte";

    import { guestStore } from "$lib/guestStore.svelte";
    import type { Snippet } from "svelte";

    let { user, configForm }: { user?: User | null; configForm?: Snippet } =
        $props();

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

    let attempts: Attempt[] = $state([]);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let isFocusAreasExpanded = $state(false);
    let showAllFocusAreas = $state(false);
    let isLoggingIn = $state(false);

    async function signInWithGoogle() {
        if (isLoggingIn) return;
        isLoggingIn = true;
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/`,
                queryParams: {
                    access_type: "offline",
                    prompt: "consent",
                },
            },
        });
        if (error) {
            console.error("Error logging in:", error.message);
            isLoggingIn = false;
        }
    }

    onMount(async () => {
        if (!user) {
            // Guest mode: load attempts from guestStore
            attempts = guestStore.attempts.map((att, idx) => ({
                id: (att as any).id || `guest-${idx}`,
                score: att.score,
                total: att.total,
                category: att.category,
                mode: att.mode,
                level: att.level,
                completed_at:
                    att.completed_at ||
                    (att as any).date ||
                    new Date().toISOString(),
            }));
            loading = false;
            return;
        }

        try {
            const { data, error: dbError } = await supabase
                .from("exam_attempts")
                .select(
                    "id, score, total, category, mode, level, completed_at, questions, user_answers",
                )
                .eq("user_id", user.id)
                .order("completed_at", { ascending: false });

            if (dbError) throw dbError;
            attempts = data || [];
        } catch (err: any) {
            console.error("Error fetching attempts:", err);
            error = "Failed to load dashboard data.";
        } finally {
            loading = false;
        }
    });

    let highScore = $derived(
        attempts.length > 0
            ? Math.max(
                  ...attempts.map((a) => Math.round((a.score / a.total) * 100)),
              )
            : 0,
    );

    let averageScore = $derived(
        attempts.length > 0
            ? Math.round(
                  attempts.reduce(
                      (acc, a) => acc + (a.score / a.total) * 100,
                      0,
                  ) / attempts.length,
              )
            : 0,
    );

    type CategoryStat = {
        category: string;
        totalCorrect: number;
        totalQuestions: number;
        percentage: number;
    };

    let categoryStats = $derived.by(() => {
        if (attempts.length === 0) return [];
        const map = new Map<string, { correct: number; total: number }>();

        attempts.forEach((att) => {
            if (att.questions && att.user_answers && att.questions.length > 0) {
                att.questions.forEach((q: any, idx: number) => {
                    const rawCat = (q.category || "").trim();
                    if (!rawCat || rawCat.toLowerCase() === "all" || rawCat.toLowerCase() === "all categories" || rawCat === "Mixed Categories" || rawCat === "General / Mixed") return;
                    if (!map.has(rawCat)) map.set(rawCat, { correct: 0, total: 0 });
                    const entry = map.get(rawCat)!;
                    entry.total++;
                    if (att.user_answers?.[idx] === q.correct_answer)
                        entry.correct++;
                });
            } else {
                const rawCat = (att.category || "").trim();
                if (!rawCat || rawCat.toLowerCase() === "all" || rawCat.toLowerCase() === "all categories" || rawCat === "Mixed Categories" || rawCat === "General / Mixed") return;
                if (!map.has(rawCat)) map.set(rawCat, { correct: 0, total: 0 });
                const entry = map.get(rawCat)!;
                entry.correct += att.score;
                entry.total += att.total;
            }
        });

        const list: CategoryStat[] = [];
        map.forEach((val, cat) => {
            const pct = Math.round((val.correct / val.total) * 100);
            list.push({
                category: cat,
                totalCorrect: val.correct,
                totalQuestions: val.total,
                percentage: pct,
            });
        });

        list.sort((a, b) => b.percentage - a.percentage);
        return list;
    });

    let overallStrongAreas = $derived(
        categoryStats.filter((c) => c.percentage >= 80),
    );
    let overallWeakAreas = $derived(
        categoryStats.filter((c) => c.percentage < 80),
    );

    function getLevelLabel(attempt: Attempt): { label: string; cls: string } {
        const lvl = (attempt.level || "").toLowerCase();
        if (lvl === "subprofessional")
            return { label: "Sub-Professional", cls: "badge-sub" };
        if (lvl === "professional")
            return { label: "Professional", cls: "badge-pro" };
        const lower = (attempt.category || "").toLowerCase();
        if (lower.includes("clerical"))
            return { label: "Sub-Professional", cls: "badge-sub" };
        return { label: "Professional", cls: "badge-pro" };
    }

    function formatDate(dateStr: string) {
        return new Date(dateStr).toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }

    let displayedAttempts = $derived(attempts.slice(0, 3));
</script>

<div class="dashboard slide-up dashboard-3-col-layout">
    <!-- COLUMN 1: Profile & Stats -->
    <div class="dashboard-col glass-card">
        <div
            style="display: flex; justify-content: space-between; align-items: flex-start; flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;"
        >
            <h2 class="dashboard-title" style="margin: 0; font-size: 1.25rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; color: white;">
                Welcome back, {user
                    ? user.user_metadata?.full_name?.split(" ")[0] || "Reviewer"
                    : "Guest"}!
            </h2>
            {#if !user}
                <span
                    class="cse-badge cse-badge-primary"
                    style="background: rgba(167, 139, 250, 0.15); border-color: rgba(167, 139, 250, 0.3); font-size: 0.75rem;"
                >
                    Guest Mode
                </span>
            {/if}
        </div>

        {#if loading}
            <div style="text-align: center; padding: 1.5rem;">
                <progress
                    class="progress"
                    max="100"
                    style="max-width: 200px; margin: 0 auto;"
                ></progress>
                <p
                    style="color: #7c6d8e; margin-top: 0.75rem; font-size: 0.9rem;"
                >
                    Loading your stats...
                </p>
            </div>
        {:else if error}
            <p class="error-text">{error}</p>
        {:else}
            <div class="stats-grid stacked-stats">
                <div
                    class="stat-card"
                    style="position: relative; overflow: hidden;"
                >
                    <div
                        style="position: absolute; top: 0.5rem; right: 0.5rem; opacity: 0.08; color: var(--cse-orange);"
                    >
                        <Trophy size={48} />
                    </div>
                    <h3>High Score</h3>
                    <div
                        class="stat-value"
                        class:success={highScore >= 75}
                        class:warning={highScore < 75}
                    >
                        {highScore}%
                    </div>
                </div>
                <div
                    class="stat-card"
                    style="position: relative; overflow: hidden;"
                >
                    <div
                        style="position: absolute; top: 0.5rem; right: 0.5rem; opacity: 0.08; color: var(--cse-primary-light);"
                    >
                        <TrendingUp size={48} />
                    </div>
                    <h3>Average</h3>
                    <div
                        class="stat-value"
                        class:success={averageScore >= 75}
                        class:warning={averageScore < 75}
                    >
                        {averageScore}%
                    </div>
                </div>
                <div
                    class="stat-card"
                    style="position: relative; overflow: hidden;"
                >
                    <div
                        style="position: absolute; top: 0.5rem; right: 0.5rem; opacity: 0.08; color: var(--cse-green);"
                    >
                        <ClipboardCheck size={48} />
                    </div>
                    <h3>Quizzes Taken</h3>
                    <div class="stat-value">{attempts.length}</div>
                </div>
            </div>
        {/if}
    </div>
    <!-- End Col 1 -->

    <!-- COLUMN 2: Configure Session -->
    <div
        class="dashboard-col glass-card"
        style="display: flex; flex-direction: column;"
    >
        {#if configForm}
            {@render configForm()}
        {/if}
    </div>

    <!-- COLUMN 3: Analytics & History -->
    <div
        class="dashboard-col glass-card"
        style="display: flex; flex-direction: column; gap: 1.5rem;"
    >
        {#if attempts.length === 0 && !loading && !error}
            <div
                class="empty-state"
                style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; flex: 1;"
            >
                <ClipboardCheck
                    size={40}
                    style="color: #7c6d8e; margin-bottom: 0.75rem;"
                />
                <p>You haven't completed any mock exams yet.</p>
                <p style="color: #7c6d8e;">
                    Start practicing to track your progress here!
                </p>
            </div>
        {:else if !loading && !error}
            {#if !user}
                <!-- Guest Mode Lock Card for Performance & Focus Areas -->
                <div class="guest-focus-lock slide-up">
                    <div class="lock-icon-badge">
                        <Lock size={22} />
                    </div>
                    <h4 class="guest-lock-title">Unlock Subject Analytics</h4>
                    <p class="guest-lock-desc">
                        Sign in to save your progress, track your strengths per subject topic, and get personalized focus area recommendations.
                    </p>
                    <button
                        class="btn-guest-login"
                        class:btn-loading={isLoggingIn}
                        disabled={isLoggingIn}
                        onclick={signInWithGoogle}
                    >
                        {#if isLoggingIn}
                            <Loader2 size={16} class="spinner-icon" /> Signing in...
                        {:else}
                            <svg class="google-icon" width="16" height="16" viewBox="0 0 24 24">
                                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"/>
                                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.4 0 15.2s.7 5.5 1.9 7.9l3.7-2.9c-.6-.8-1-1.8-1-2.9z"/>
                                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 22.3 12 23z"/>
                            </svg>
                            Sign in with Google
                        {/if}
                    </button>
                </div>
            {:else}
                <!-- Overall Focus Areas for Logged In User -->
                <h3
                    style="font-size: 0.95rem; font-weight: 700; color: var(--cse-primary-light); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;"
                >
                    <Sparkles size={16} /> Performance & Focus Areas
                </h3>

                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                    <!-- Strong Areas Section -->
                    <div>
                        <div
                            style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.6rem; color: #34d399; font-weight: 700; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.5px;"
                        >
                            <CheckCircle2 size={15} /> Strong Areas (≥80%)
                        </div>
                        {#if overallStrongAreas.length > 0}
                            <div
                                style="display: flex; flex-direction: column; gap: 0.45rem;"
                            >
                                {#each overallStrongAreas as item, idx}
                                    <div
                                        class="focus-area-item"
                                        class:mobile-hidden={idx >= 3 &&
                                            !isFocusAreasExpanded}
                                        style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; font-size: 0.82rem; padding: 0.2rem 0; border-bottom: 1px dashed rgba(255, 255, 255, 0.05);"
                                    >
                                        <span
                                            style="color: #e2e8f0; font-weight: 500; line-height: 1.4;"
                                            >{item.category}</span
                                        >
                                        <span
                                            style="font-weight: 800; color: #34d399; font-family: var(--font-body); font-variant-numeric: tabular-nums lining-nums; flex-shrink: 0;"
                                            >{item.percentage}%</span
                                        >
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <p
                                style="font-size: 0.78rem; color: #7c6d8e; margin: 0;"
                            >
                                Complete practice quizzes at ≥80% accuracy to
                                highlight your strong subjects.
                            </p>
                        {/if}
                    </div>

                    <!-- Needs Practice Section -->
                    <div>
                        <div
                            style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.6rem; color: #fbbf24; font-weight: 700; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.5px;"
                        >
                            <AlertTriangle size={15} /> Needs Practice (&lt;80%)
                        </div>
                        {#if overallWeakAreas.length > 0}
                            <div
                                style="display: flex; flex-direction: column; gap: 0.45rem;"
                            >
                                {#each overallWeakAreas as item, idx}
                                    <div
                                        class="focus-area-item"
                                        class:mobile-hidden={idx >= 3 &&
                                            !isFocusAreasExpanded}
                                        style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; font-size: 0.82rem; padding: 0.2rem 0; border-bottom: 1px dashed rgba(255, 255, 255, 0.05);"
                                    >
                                        <span
                                            style="color: #e2e8f0; font-weight: 500; line-height: 1.4;"
                                            >{item.category}</span
                                        >
                                        <span
                                            style="font-weight: 800; color: #fbbf24; font-family: var(--font-body); font-variant-numeric: tabular-nums lining-nums; flex-shrink: 0;"
                                            >{item.percentage}%</span
                                        >
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <p
                                style="font-size: 0.78rem; color: #34d399; margin: 0;"
                            >
                                Great job! No weak areas detected in your recent
                                exam attempts.
                            </p>
                        {/if}
                    </div>

                    {#if overallStrongAreas.length > 3 || overallWeakAreas.length > 3}
                        <button
                            class="modern-expand-btn"
                            onclick={() =>
                                (isFocusAreasExpanded = !isFocusAreasExpanded)}
                            aria-expanded={isFocusAreasExpanded}
                        >
                            <span
                                >{isFocusAreasExpanded
                                    ? "Show Less"
                                    : "Show All"}</span
                            >
                            <span
                                class="expand-icon-pill"
                                class:rotated={isFocusAreasExpanded}
                            >
                                <ChevronDown size={14} />
                            </span>
                        </button>
                    {/if}
                </div>
            {/if}
        {/if}
    </div>
    <!-- End Col 3 -->
</div>

{#if !loading && !error && attempts.length > 0}
    <div
        class="recent-activity-card glass-card slide-up"
        style="max-width: 1400px; margin: 1.5rem auto 0 auto; padding: 1.5rem;"
    >
        <div
            style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;"
        >
            <h3
                style="font-size: 1rem; font-weight: 700; color: var(--cse-primary-light); text-transform: uppercase; letter-spacing: 1px; margin: 0;"
            >
                Recent Activity
            </h3>
            {#if attempts.length > 3}
                <button
                    class="btn-see-all-inline"
                    onclick={() => goto("/exams")}
                    style="display: inline-flex; align-items: center; gap: 0.35rem; background: none; border: none; color: var(--cse-primary-light); font-size: 0.85rem; font-weight: 600; cursor: pointer; font-family: var(--font-body);"
                >
                    See All Exams ({attempts.length}) <ArrowRight size={14} />
                </button>
            {/if}
        </div>

        <div
            class="activity-list"
            style="display: flex; flex-direction: column; gap: 0.75rem;"
        >
            {#each displayedAttempts as attempt}
                {@const pct = Math.round((attempt.score / attempt.total) * 100)}
                {@const level = getLevelLabel(attempt)}
                <div class="activity-item">
                    <div class="activity-info">
                        <strong
                            >{attempt.category === "all" ||
                            attempt.category === ""
                                ? "Mixed Categories"
                                : attempt.category}</strong
                        >
                        <div
                            class="activity-meta-row"
                            style="display: flex; align-items: center; gap: 0.5rem;"
                        >
                            <span
                                class="level-badge {level.cls}"
                                style="display: inline-flex; align-items: center; gap: 0.25rem;"
                            >
                                {#if level.label.includes("Professional")}
                                    <GraduationCap size={11} />
                                {:else}
                                    <Award size={11} />
                                {/if}
                                {level.label}
                            </span>
                            <small
                                style="display: inline-flex; align-items: center; gap: 0.25rem; color: #7c6d8e;"
                            >
                                <Calendar size={11} />
                                {formatDate(attempt.completed_at)}
                            </small>
                        </div>
                        <small
                            class="mode-label"
                            style="display: inline-flex; align-items: center; gap: 0.25rem; margin-top: 0.25rem;"
                        >
                            {#if attempt.mode === "mock"}
                                <Clock size={11} /> Mock Exam
                            {:else}
                                <FileText size={11} /> Practice Mode
                            {/if}
                        </small>
                    </div>
                    <div class="activity-right">
                        <span
                            class="score-badge"
                            class:good={pct >= 75}
                            class:needs-work={pct < 75}
                        >
                            {attempt.score}/{attempt.total}
                        </span>
                        <button
                            class="btn-view-submission"
                            onclick={() => goto("/submission/" + attempt.id)}
                        >
                            View Submission
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    </div>
{/if}

<style>
    .dashboard {
        margin-bottom: 100rem;
    }

    .dashboard-3-col-layout {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
        align-items: stretch;
        max-width: 1400px;
        margin: 0 auto;
    }

    .dashboard-col {
        padding: 1.25rem;
    }

    @media (max-width: 1024px) {
        .dashboard-3-col-layout {
            grid-template-columns: 1fr;
        }
    }

    .dashboard-title {
        font-family: var(--font-display);
        font-size: 2rem;
        font-weight: 800;
        letter-spacing: -1px;
        background: linear-gradient(135deg, #fff, #a78bfa);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
    }

    .error-text {
        color: var(--cse-red);
        background: rgba(248, 113, 113, 0.1);
        padding: 1rem;
        border-radius: 8px;
        text-align: center;
        border: 1px solid rgba(248, 113, 113, 0.3);
    }

    .stats-grid.stacked-stats {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .stat-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 1.25rem;
        transition: var(--cse-transition);
        position: relative;
    }

    .stat-card h3 {
        margin: 0 0 0.5rem 0;
        font-size: 0.7rem;
        color: #7c6d8e;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 700;
    }

    .stat-value {
        font-size: 1.8rem;
        font-weight: 800;
        color: var(--cse-text);
        font-family: var(--font-body);
        font-variant-numeric: tabular-nums lining-nums;
    }

    .stat-value.success {
        color: var(--cse-green);
    }
    .stat-value.warning {
        color: var(--cse-orange);
    }

    .analytics-card {
        margin-top: 0 !important;
        margin-bottom: 0 !important;
    }

    .analytics-card > div {
        flex-direction: column;
    }

    .recent-activity h3 {
        font-size: 1.1rem;
        font-weight: 700;
        color: white;
        margin-bottom: 1.2rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding-bottom: 0.5rem;
    }

    .activity-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .activity-item {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 0.85rem 1.25rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: var(--cse-transition);
        flex-direction: row;
        gap: 1rem;
    }

    .activity-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        flex: 1;
        min-width: 0;
    }

    .activity-info strong {
        font-size: 0.95rem;
        color: var(--cse-text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .activity-meta-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .activity-info small {
        color: #7c6d8e;
        font-size: 0.75rem;
    }
    .mode-label {
        color: #7c6d8e;
        font-size: 0.72rem;
    }

    .level-badge {
        display: inline-block;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-size: 0.65rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        white-space: nowrap;
    }

    .badge-pro {
        background: rgba(99, 102, 241, 0.15);
        color: #a5b4fc;
        border: 1px solid rgba(99, 102, 241, 0.3);
    }

    .badge-sub {
        background: rgba(251, 191, 36, 0.12);
        color: var(--cse-orange);
        border: 1px solid rgba(251, 191, 36, 0.25);
    }

    .activity-right {
        display: flex;
        align-items: center;
        gap: 1.25rem;
        width: auto;
        justify-content: flex-end;
    }

    .score-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 999px;
        font-weight: 700;
        font-size: 0.78rem;
        white-space: nowrap;
    }

    .score-badge.good {
        background: rgba(52, 211, 153, 0.12);
        color: var(--cse-green);
        border: 1px solid rgba(52, 211, 153, 0.25);
    }

    .score-badge.needs-work {
        background: rgba(251, 191, 36, 0.12);
        color: var(--cse-orange);
        border: 1px solid rgba(251, 191, 36, 0.25);
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

    .btn-see-all {
        display: block;
        width: 100%;
        margin-top: 0.75rem;
        padding: 0.65rem 1rem;
        background: rgba(255, 255, 255, 0.03);
        border: 1px dashed rgba(255, 255, 255, 0.1);
        border-radius: var(--cse-radius-sm);
        color: #7c6d8e;
        font-size: 0.8rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: var(--font-body);
        text-align: center;
    }

    .btn-see-all:hover {
        background: rgba(139, 92, 246, 0.07);
        border-color: rgba(139, 92, 246, 0.3);
        color: var(--cse-primary-light, #a78bfa);
    }

    :global(.blank-line) {
        display: inline-block;
        width: 80px;
        border-bottom: 2px solid rgba(255, 255, 255, 0.4);
        margin: 0 2px;
        vertical-align: bottom;
    }

    .analytics-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(10, 8, 20, 0.82);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
        overflow-y: auto;
    }

    .analytics-modal-card {
        max-width: 650px;
        width: 100%;
        max-height: 90vh;
        overflow-y: auto;
        padding: 1.75rem;
        border-radius: 16px;
        border: 1px solid rgba(167, 139, 250, 0.25);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }

    .modern-expand-btn {
        display: none;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        width: 100%;
        margin-top: 0.75rem;
        padding: 0.55rem 1rem;
        background: rgba(139, 92, 246, 0.08);
        border: 1px solid rgba(167, 139, 250, 0.2);
        border-radius: 999px;
        color: var(--cse-primary-light);
        font-family: var(--font-body);
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(8px);
    }

    .modern-expand-btn:hover,
    .modern-expand-btn:active {
        background: rgba(139, 92, 246, 0.16);
        border-color: rgba(167, 139, 250, 0.4);
        color: white;
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
    }

    .expand-icon-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .expand-icon-pill.rotated {
        transform: rotate(180deg);
    }    /* Guest Lock Card for Performance & Focus Areas */
    .guest-focus-lock {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 2.5rem 1.5rem;
        min-height: 340px;
        height: 100%;
        background: linear-gradient(145deg, rgba(124, 58, 237, 0.12), rgba(20, 15, 38, 0.6));
        border: 1px solid rgba(167, 139, 250, 0.25);
        border-radius: 14px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        backdrop-filter: blur(12px);
    }

    .lock-icon-badge {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: linear-gradient(135deg, rgba(167, 139, 250, 0.2), rgba(124, 58, 237, 0.1));
        border: 1px solid rgba(167, 139, 250, 0.35);
        color: #c4b5fd;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1rem;
        box-shadow: 0 0 16px rgba(167, 139, 250, 0.2);
    }

    .guest-lock-title {
        font-size: 1.1rem;
        font-weight: 700;
        color: white;
        margin: 0 0 0.5rem 0;
        font-family: var(--font-body);
        letter-spacing: -0.3px;
    }

    .guest-lock-desc {
        font-size: 0.85rem;
        color: #c4b5fd;
        line-height: 1.5;
        margin: 0 0 1.5rem 0;
        max-width: 300px;
        font-family: var(--font-body);
        opacity: 0.9;
    }

    .btn-guest-login {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.6rem;
        padding: 0.65rem 1.35rem;
        background: linear-gradient(135deg, var(--cse-primary), #6d28d9);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 999px;
        color: white;
        font-size: 0.88rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: var(--font-body);
        box-shadow: 0 4px 16px rgba(124, 58, 237, 0.35);
    }

    .btn-guest-login:hover {
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        border-color: rgba(255, 255, 255, 0.4);
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(124, 58, 237, 0.5);
    }

    .google-icon {
        background: white;
        border-radius: 50%;
        padding: 2px;
        box-sizing: content-box;
    }

    @media (max-width: 1024px) {
        .modern-expand-btn {
            display: flex;
        }
        .focus-area-item.mobile-hidden {
            display: none !important;
        }
        .dashboard-title {
            font-size: 1.2rem;
        }
        .activity-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
        }
        .activity-right {
            width: 100%;
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
        }
        .stats-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
