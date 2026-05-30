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

-- Row Level Security (RLS) for Questions
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions are viewable by everyone" ON public.questions FOR SELECT USING (true);

-- Function to efficiently get random questions
CREATE OR REPLACE FUNCTION get_random_questions(p_limit int, p_category text DEFAULT NULL)
RETURNS SETOF public.questions
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_category IS NOT NULL THEN
    RETURN QUERY
    SELECT * FROM public.questions
    WHERE category = p_category
    ORDER BY random()
    LIMIT p_limit;
  ELSE
    RETURN QUERY
    SELECT * FROM public.questions
    ORDER BY random()
    LIMIT p_limit;
  END IF;
END;
$$;

-- Profiles Table (linked with Supabase Auth)
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text NOT NULL,
  display_name text,
  avatar_url text,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Row Level Security (RLS) for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to automatically create profile on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'User'),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Exam Attempts / Scores Table
CREATE TABLE public.exam_attempts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  score integer NOT NULL,
  total integer NOT NULL,
  category text NOT NULL,
  mode text NOT NULL,
  completed_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Attempts
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own score history" ON public.exam_attempts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own attempts" ON public.exam_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

