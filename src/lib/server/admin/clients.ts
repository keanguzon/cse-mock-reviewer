import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';
import { encryptionKey } from './crypto';

export function adminConfig() {
  const url = publicEnv.PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const key = env.ADMIN_SESSION_ENCRYPTION_KEY;
  const origin = env.ADMIN_ALLOWED_ORIGIN;
  try {
    if (!url || !anonKey || !serviceKey || !key || !origin) throw new Error();
    const parsed = new URL(origin);
    if (parsed.origin !== origin || !['https:', 'http:'].includes(parsed.protocol)) throw new Error();
    if (parsed.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) throw new Error();
    encryptionKey(key);
    return { url, anonKey, serviceKey, encryptionKey: key, origin };
  } catch {
    error(503, 'Administrator sign-in is unavailable.');
  }
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export function serviceClient() {
  const config = adminConfig();
  return createClient(config.url, config.serviceKey, options);
}

export function credentialClient() {
  const config = adminConfig();
  return createClient(config.url, config.anonKey, options);
}
