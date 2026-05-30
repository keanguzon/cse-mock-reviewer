-- Supabase Schema for Civil Service Reviewer App

-- Questions Table
CREATE TABLE public.questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL,
  question text NOT NULL,
  choices jsonb NOT NULL,
  correct_answer text NOT NULL,
  explanation text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: When migrating the dummy_questions.json to Supabase, 
-- you can use the Supabase dashboard to import the JSON file directly.
