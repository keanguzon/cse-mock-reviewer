import { supabase } from '$lib/supabaseClient';

export const load = async ({ url, fetch }) => {
    const mode = url.searchParams.get('mode') || 'practice';
    const category = url.searchParams.get('category') || '';
    const limit = url.searchParams.get('limit') || '20';
    const level = url.searchParams.get('level') || 'professional';

    // Fetch from our local mocked API route
    let apiUrl = `/api/questions?limit=${limit}&level=${level}`;
    if (category) {
        apiUrl += `&category=${encodeURIComponent(category)}`;
    }

    const headers: Record<string, string> = {};

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            apiUrl += `&userId=${encodeURIComponent(session.user.id)}`;
            headers['Authorization'] = `Bearer ${session.access_token}`;
        }
    } catch (e) {
        // Fallback for guest mode or server environment
    }

    const res = await fetch(apiUrl, { headers });
    const questions = await res.json();

    return {
        questions,
        mode,
        category,
        level
    };
};
