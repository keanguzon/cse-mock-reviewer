import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { env } from '$env/dynamic/public';
import { allQuestions, getQuestionsByLevel, type ExamLevel } from '$lib/questions';

export async function GET({ url }) {
    const category = url.searchParams.get('category');
    const limitParam = url.searchParams.get('limit');
    const level = (url.searchParams.get('level') || 'professional') as ExamLevel;
    const limit = limitParam ? parseInt(limitParam) : 20;

    const isSupabaseConfigured = env.PUBLIC_SUPABASE_URL && 
                                 env.PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co' &&
                                 env.PUBLIC_SUPABASE_ANON_KEY &&
                                 env.PUBLIC_SUPABASE_ANON_KEY !== 'placeholder-key';

    if (isSupabaseConfigured) {
        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_random_questions', { 
                p_limit: limit, 
                p_category: category 
            });

            if (!rpcError && rpcData && rpcData.length > 0) {
                return json(rpcData);
            }

            let query = supabase.from('questions').select('*');
            if (category) {
                query = query.eq('category', category);
            }
            query = query.limit(limit * 5);
            
            const { data, error } = await query;
            if (!error && data && data.length > 0) {
                let questions = [...data];
                for (let i = questions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [questions[i], questions[j]] = [questions[j], questions[i]];
                }
                return json(questions.slice(0, limit));
            }
            
            console.warn("Supabase fetch returned empty or error, falling back to local JSON...");
        } catch (dbError) {
            console.error("Supabase query failed, falling back to local JSON:", dbError);
        }
    }

    // Graceful fallback to local JSON files
    try {
        let questions = getQuestionsByLevel(level);

        // Optional filtering by category
        if (category) {
            questions = questions.filter(q => q.category === category);
        }

        // Shuffle questions (Fisher-Yates)
        let shuffled = [...questions];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return json(shuffled.slice(0, limit));
    } catch (e) {
        console.error("Error with questions:", e);
        return json({ error: "Failed to load questions" }, { status: 500 });
    }
}
