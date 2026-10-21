-- Fresh replay baseline; existing manually initialized tables and question rows are preserved.
CREATE TABLE IF NOT EXISTS public.questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, category text NOT NULL, question text NOT NULL,
  choices jsonb NOT NULL, correct_answer text NOT NULL, explanation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, email text NOT NULL,
  display_name text, avatar_url text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL, total integer NOT NULL, category text NOT NULL, mode text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(), questions jsonb, user_answers jsonb, level text
);
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS questions jsonb;
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS user_answers jsonb;
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS level text;
CREATE TABLE IF NOT EXISTS public.active_sessions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questions' AND policyname='Questions are viewable by everyone') THEN
    CREATE POLICY "Questions are viewable by everyone" ON public.questions FOR SELECT USING (true);
  END IF;
END $$;
GRANT SELECT ON public.questions TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.get_random_questions(p_limit integer,p_category text DEFAULT NULL)
RETURNS SETOF public.questions LANGUAGE sql SET search_path='' AS $$
  SELECT * FROM public.questions WHERE p_category IS NULL OR category=p_category ORDER BY random() LIMIT p_limit
$$;
