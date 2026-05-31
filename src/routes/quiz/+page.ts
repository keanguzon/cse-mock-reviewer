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

    const res = await fetch(apiUrl);
    const questions = await res.json();

    return {
        questions,
        mode,
        category,
        level
    };
};
