-- Create active_sessions table for saving ongoing/paused exam state per user
CREATE TABLE IF NOT EXISTS public.active_sessions (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  session_data jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid errors on rerun
DROP POLICY IF EXISTS "Users can view their own active session" ON public.active_sessions;
DROP POLICY IF EXISTS "Users can insert/update/delete their own active session" ON public.active_sessions;

-- Create Policies
CREATE POLICY "Users can view their own active session" 
  ON public.active_sessions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert/update/delete their own active session" 
  ON public.active_sessions FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
