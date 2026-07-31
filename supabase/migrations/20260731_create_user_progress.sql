-- Create user_progress table for Spaced Repetition (Smart Review)
CREATE TABLE IF NOT EXISTS public.user_progress (
    user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
    seen_questions TEXT[] DEFAULT '{}',
    wrong_questions TEXT[] DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own progress" 
ON public.user_progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress" 
ON public.user_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" 
ON public.user_progress 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Backfill script to ensure all existing users with exam_attempts have a row in user_progress.
INSERT INTO public.user_progress (user_id, seen_questions, wrong_questions, updated_at)
SELECT DISTINCT user_id, '{}'::TEXT[], '{}'::TEXT[], NOW()
FROM public.exam_attempts
WHERE user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;
