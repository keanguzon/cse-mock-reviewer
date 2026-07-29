import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

const supabaseUrl = env.PUBLIC_SUPABASE_URL || 'https://raemauglseshwxbcqwsi.supabase.co';
const supabaseKey = env.PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhZW1hdWdsc2VzaHd4YmNxd3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNjI0MjcsImV4cCI6MjA5NTczODQyN30.EkZbhEZwtZTeWe-AIYvOGdNGnsoV7rjBuWO09hMBU_k';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

