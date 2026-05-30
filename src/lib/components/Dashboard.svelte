<script lang="ts">
    import { supabase } from '$lib/supabaseClient';
    import { onMount } from 'svelte';
    import type { User } from '@supabase/supabase-js';

    let { user }: { user: User } = $props();

    interface Attempt {
        id: string;
        score: number;
        total: number;
        category: string;
        mode: string;
        completed_at: string;
    }

    let attempts: Attempt[] = $state([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    onMount(async () => {
        if (!user) return;
        
        try {
            const { data, error: dbError } = await supabase
                .from('exam_attempts')
                .select('*')
                .eq('user_id', user.id)
                .order('completed_at', { ascending: false })
                .limit(10);
                
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
            ? Math.max(...attempts.map(a => Math.round((a.score / a.total) * 100))) 
            : 0
    );

    let averageScore = $derived(
        attempts.length > 0
            ? Math.round(attempts.reduce((acc, a) => acc + (a.score / a.total) * 100, 0) / attempts.length)
            : 0
    );
</script>

<div class="dashboard glass-card slide-up">
    <h2 class="dashboard-title">Welcome back, {user.user_metadata.full_name?.split(' ')[0] || 'Reviewer'}! 👋</h2>
    
    {#if loading}
        <div style="text-align: center; padding: 1.5rem;">
            <progress class="progress" max="100" style="max-width: 200px; margin: 0 auto;"></progress>
            <p style="color: #7c6d8e; margin-top: 0.75rem; font-size: 0.9rem;">Loading your stats...</p>
        </div>
    {:else if error}
        <p class="error-text">{error}</p>
    {:else if attempts.length === 0}
        <div class="empty-state">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📝</div>
            <p>You haven't completed any mock exams yet.</p>
            <p style="color: #7c6d8e;">Start practicing to track your progress here!</p>
        </div>
    {:else}
        <div class="stats-grid">
            <div class="stat-card">
                <h3>High Score</h3>
                <div class="stat-value" class:success={highScore >= 75} class:warning={highScore < 75}>
                    {highScore}%
                </div>
            </div>
            <div class="stat-card">
                <h3>Average</h3>
                <div class="stat-value" class:success={averageScore >= 75} class:warning={averageScore < 75}>
                    {averageScore}%
                </div>
            </div>
            <div class="stat-card">
                <h3>Quizzes Taken</h3>
                <div class="stat-value">
                    {attempts.length}
                </div>
            </div>
        </div>

        <div class="recent-activity">
            <h3>Recent Activity</h3>
            <div class="activity-list">
                {#each attempts as attempt}
                    <div class="activity-item">
                        <div class="activity-info">
                            <strong>{attempt.category === 'all' ? 'Mixed Categories' : attempt.category}</strong>
                            <small>{new Date(attempt.completed_at).toLocaleDateString()}</small>
                        </div>
                        <div class="activity-score">
                            <span class="score-badge" class:good={attempt.score/attempt.total >= 0.75} class:needs-work={attempt.score/attempt.total < 0.75}>
                                {attempt.score} / {attempt.total}
                            </span>
                        </div>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .dashboard {
        margin-bottom: 2rem;
    }
    
    .dashboard-title {
        margin-top: 0;
        margin-bottom: 1.5rem;
        font-size: 1.4rem;
        font-family: var(--font-display);
        background: linear-gradient(135deg, #d8b4fe, #e879f9);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .error-text {
        color: var(--cse-red);
        text-align: center;
    }

    .empty-state {
        text-align: center;
        padding: 1.5rem;
        color: #94a3b8;
    }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1.5rem;
    }

    .stat-card {
        background: rgba(255, 255, 255, 0.04);
        padding: 1.25rem;
        border-radius: var(--cse-radius-sm);
        border: 1px solid var(--cse-border);
        text-align: center;
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
        font-family: var(--font-display);
    }

    .stat-value.success { color: var(--cse-green); }
    .stat-value.warning { color: var(--cse-orange); }

    .recent-activity h3 {
        margin-bottom: 0.75rem;
        font-size: 0.95rem;
        color: var(--cse-text);
        font-weight: 700;
    }

    .activity-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .activity-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background: rgba(255, 255, 255, 0.03);
        border-radius: var(--cse-radius-sm);
        border: 1px solid var(--cse-border);
    }

    .activity-info {
        display: flex;
        flex-direction: column;
    }

    .activity-info strong {
        font-size: 0.85rem;
        color: var(--cse-text);
    }

    .activity-info small {
        color: #7c6d8e;
        font-size: 0.75rem;
    }

    .score-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 999px;
        font-weight: 700;
        font-size: 0.78rem;
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
</style>
