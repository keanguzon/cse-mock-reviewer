import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { env } from '$env/dynamic/public';
import { getQuestionsByLevel, type ExamLevel } from '$lib/questions';
import { createClient } from '@supabase/supabase-js';

export async function GET({ url, request }) {
    const rawCategory = url.searchParams.get('category');
    const limitParam = url.searchParams.get('limit');
    const levelParam = url.searchParams.get('level');
    const userId = url.searchParams.get('userId');
    const isRealistic = url.searchParams.get('realistic') === 'true';

    // Bound limit strictly between 1 and 2000.
    const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 2000);

    // Sanitize level and category inputs.
    const level: ExamLevel = levelParam === 'subprofessional' ? 'subprofessional' : 'professional';
    const category = typeof rawCategory === 'string' && rawCategory.trim().length > 0 ? rawCategory.trim() : null;

    // Security and cache control response headers.
    const responseHeaders = {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'X-Content-Type-Options': 'nosniff'
    };

    const isSupabaseConfigured = env.PUBLIC_SUPABASE_URL && 
                                 env.PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co' &&
                                 env.PUBLIC_SUPABASE_ANON_KEY &&
                                 env.PUBLIC_SUPABASE_ANON_KEY !== 'placeholder-key';

    let seen_questions: string[] = [];
    let wrong_questions: string[] = [];

    const authHeader = request.headers.get('authorization');

    // Fetch user progress if user ID or auth header is provided and Supabase is configured
    if (isSupabaseConfigured && (userId || authHeader)) {
        try {
            const dbClient = authHeader 
                ? createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
                    global: { headers: { Authorization: authHeader } }
                  })
                : supabase;

            let query = dbClient.from('user_progress').select('seen_questions, wrong_questions');
            if (userId) {
                query = query.eq('user_id', userId);
            }
            const { data: progressData, error: progressError } = await query.maybeSingle();
            
            if (!progressError && progressData) {
                seen_questions = progressData.seen_questions || [];
                wrong_questions = progressData.wrong_questions || [];
            }
        } catch (e) {
            console.error("Failed to fetch user_progress:", e);
        }
    }

    try {
        let allValidQuestions = getQuestionsByLevel(level);

        // Optional filtering by category.
        if (category) {
            allValidQuestions = allValidQuestions.filter(q => q.category === category);
        }

        // Shuffle helper function using Fisher-Yates
        const shuffle = (array: any[]) => {
            let shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        };

        // Helper to pull N questions given a filter condition
        const pullQuestions = (pool: any[], targetLimit: number, condition?: (q: any) => boolean) => {
            let candidates = condition ? pool.filter(condition) : pool;
            // Priorities: Unseen -> Wrong -> Correct
            let unseen = shuffle(candidates.filter(q => !seen_questions.includes(q.id)));
            let selectedChunk = unseen.slice(0, targetLimit);

            if (selectedChunk.length < targetLimit) {
                let wrong = shuffle(candidates.filter(q => wrong_questions.includes(q.id)));
                selectedChunk = [...selectedChunk, ...wrong.slice(0, targetLimit - selectedChunk.length)];
            }
            if (selectedChunk.length < targetLimit) {
                let correct = shuffle(candidates.filter(q => seen_questions.includes(q.id) && !wrong_questions.includes(q.id)));
                selectedChunk = [...selectedChunk, ...correct.slice(0, targetLimit - selectedChunk.length)];
            }
            
            // Do NOT shuffle the final chunk so that unseen questions strictly appear first
            return selectedChunk;
        };

        // Pull questions proportionally across all sub-categories within a parent group
        const pullProportional = (pool: any[], totalQuota: number, condition: (q: any) => boolean) => {
            const filtered = pool.filter(condition);
            const subCats = [...new Set(filtered.map(q => q.category))];
            if (subCats.length === 0) return [];
            const perSubCat = Math.floor(totalQuota / subCats.length);
            const remainder = totalQuota % subCats.length;
            let result: any[] = [];
            subCats.forEach((cat, i) => {
                const quota = perSubCat + (i < remainder ? 1 : 0);
                result.push(...pullQuestions(pool, quota, q => q.category === cat));
            });
            return result;
        };

        let selected: any[] = [];

        if (isRealistic) {
            if (level === 'professional') {
                // Professional: 29.41% Verbal, 29.41% Analytical, 29.41% Numerical, 11.76% Gen Info
                const v = Math.round(limit * (50 / 170));
                const a = Math.round(limit * (50 / 170));
                const n = Math.round(limit * (50 / 170));
                const g = limit - (v + a + n); // Ensure exact total match

                selected.push(...pullProportional(allValidQuestions, v, q => q.category.includes('Verbal')));
                selected.push(...pullProportional(allValidQuestions, a, q => q.category.includes('Analytical')));
                selected.push(...pullProportional(allValidQuestions, n, q => q.category.includes('Numerical')));
                selected.push(...pullProportional(allValidQuestions, g, q => q.category.includes('General Information')));
            } else {
                // Sub-Professional: 30.3% Verbal, 30.3% Clerical, 27.27% Numerical, 12.12% Gen Info
                const v = Math.round(limit * (50 / 165));
                const c = Math.round(limit * (50 / 165));
                const n = Math.round(limit * (45 / 165));
                const g = limit - (v + c + n); // Ensure exact total match

                selected.push(...pullProportional(allValidQuestions, v, q => q.category.includes('Verbal')));
                selected.push(...pullProportional(allValidQuestions, c, q => q.category.includes('Clerical')));
                selected.push(...pullProportional(allValidQuestions, n, q => q.category.includes('Numerical')));
                selected.push(...pullProportional(allValidQuestions, g, q => q.category.includes('General Information')));
            }
        } else {
            // Standard Random Exam Mode
            selected = pullQuestions(allValidQuestions, limit);
        }

        return json(selected, { headers: responseHeaders });
    } catch (e) {
        console.error("Error with questions:", e);
        return json({ error: "Failed to load questions" }, { status: 500, headers: responseHeaders });
    }
}
