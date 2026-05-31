-- Run this in your Supabase SQL Editor
-- Dashboard > SQL Editor > New Query

ALTER TABLE exam_attempts
  ADD COLUMN IF NOT EXISTS questions   jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user_answers jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS level        text  DEFAULT NULL;
