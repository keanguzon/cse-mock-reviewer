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

    // Bound limit strictly between 1 and 150.
    const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 150);

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

        // Priority 1: Unseen questions
        let unseen = allValidQuestions.filter(q => !seen_questions.includes(q.id));
        unseen = shuffle(unseen);
        
        let selected = unseen.slice(0, limit);

        // Priority 2: Fill remaining with wrong questions (Mastery)
        if (selected.length < limit) {
            let wrong = allValidQuestions.filter(q => wrong_questions.includes(q.id));
            wrong = shuffle(wrong);
            const needed = limit - selected.length;
            selected = [...selected, ...wrong.slice(0, needed)];
        }

        // Priority 3: Fill remaining with random previously correct questions (Refresh)
        if (selected.length < limit) {
            let correct = allValidQuestions.filter(q => seen_questions.includes(q.id) && !wrong_questions.includes(q.id));
            correct = shuffle(correct);
            const needed = limit - selected.length;
            selected = [...selected, ...correct.slice(0, needed)];
        }

        // Final shuffle so the user doesn't know which is unseen vs wrong
        selected = shuffle(selected);

        return json(selected, { headers: responseHeaders });
    } catch (e) {
        console.error("Error with questions:", e);
        return json({ error: "Failed to load questions" }, { status: 500, headers: responseHeaders });
    }
}
