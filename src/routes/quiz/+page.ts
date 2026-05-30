export const load = async ({ url, fetch }) => {
    const mode = url.searchParams.get('mode') || 'practice';
    const category = url.searchParams.get('category') || '';

    // Fetch from our local mocked API route
    let apiUrl = '/api/questions?limit=20';
    if (category) {
        apiUrl += `&category=${encodeURIComponent(category)}`;
    }

    const res = await fetch(apiUrl);
    const questions = await res.json();

    return {
        questions,
        mode,
        category
    };
};
