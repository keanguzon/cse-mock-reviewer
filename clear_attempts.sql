-- Clears ALL exam attempt records for your account
-- Run this in: Supabase Dashboard → SQL Editor → New Query

DELETE FROM exam_attempts;

-- Or if you only want to delete YOUR records specifically (safer if multiple users):
-- DELETE FROM exam_attempts WHERE user_id = auth.uid();
