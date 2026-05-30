import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';

export async function GET({ url }) {
    // In the future, this will be:
    // const { data, error } = await supabase.from('questions').select('*');
    // if (error) return new Response(String(error), { status: 500 });

    try {
        // Read dummy data for now
        const filePath = path.resolve('api/dummy_questions.json');
        const data = fs.readFileSync(filePath, 'utf-8');
        let questions = JSON.parse(data);

        // Optional filtering by category
        const category = url.searchParams.get('category');
        if (category) {
            questions = questions.filter((q: any) => q.category === category);
        }

        // Shuffle questions for randomness (Fisher-Yates)
        for (let i = questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questions[i], questions[j]] = [questions[j], questions[i]];
        }

        // Optional limit
        const limit = url.searchParams.get('limit');
        if (limit) {
            questions = questions.slice(0, parseInt(limit));
        }

        return json(questions);
    } catch (e) {
        console.error("Error reading dummy questions:", e);
        return json({ error: "Failed to load questions" }, { status: 500 });
    }
}
