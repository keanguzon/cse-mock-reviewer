import { createClient } from '@supabase/supabase-js';

// These should eventually come from environment variables e.g., $env/static/public
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseKey);
