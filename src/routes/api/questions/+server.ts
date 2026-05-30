import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { env } from '$env/dynamic/public';
import fs from 'fs';
import path from 'path';

export async function GET({ url }) {
    const category = url.searchParams.get('category');
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : 20;

    const isSupabaseConfigured = env.PUBLIC_SUPABASE_URL && 
                                 env.PUBLIC_SUPABASE_URL !== 'https://placeholder.supabase.co' &&
                                 env.PUBLIC_SUPABASE_ANON_KEY &&
                                 env.PUBLIC_SUPABASE_ANON_KEY !== 'placeholder-key';

    if (isSupabaseConfigured) {
        try {
            // 1. Try to use the database RPC function for efficient random fetching
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_random_questions', { 
                p_limit: limit, 
                p_category: category 
            });

            if (!rpcError && rpcData && rpcData.length > 0) {
                return json(rpcData);
            }

            // 2. Fallback to basic fetch if the RPC isn't deployed yet
            // We use a safe limit (e.g., limit * 5) to prevent fetching 100,000s of rows into memory
            let query = supabase.from('questions').select('*');
            if (category) {
                query = query.eq('category', category);
            }
            query = query.limit(limit * 5);
            
            const { data, error } = await query;
            if (!error && data && data.length > 0) {
                // Shuffle questions locally
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

    // Graceful fallback to local JSON file
    try {
        const filePath = path.resolve('api/dummy_questions.json');
        const data = fs.readFileSync(filePath, 'utf-8');
        let questions = JSON.parse(data);

        // Optional filtering by category
        if (category) {
            questions = questions.filter((q: any) => q.category === category);
        }

        // Shuffle questions (Fisher-Yates)
        for (let i = questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questions[i], questions[j]] = [questions[j], questions[i]];
        }

        return json(questions.slice(0, limit));
    } catch (e) {
        console.error("Error reading dummy questions JSON:", e);
        return json({ error: "Failed to load questions" }, { status: 500 });
    }
}

