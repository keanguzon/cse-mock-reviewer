import { error, json } from '@sveltejs/kit';
import { getCsrf, reauthenticateAdmin } from '$lib/server/admin/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
  const type = event.request.headers.get('content-type')?.split(';')[0];
  let password: unknown;
  try {
    password = type === 'application/json'
      ? (await event.request.clone().json()).password
      : (await event.request.clone().formData()).get('password');
  } catch { error(400, 'Invalid request.'); }
  if (typeof password !== 'string' || !password || password.length > 1024) error(400, 'Unable to sign in with these credentials.');
  const ctx = await reauthenticateAdmin(event, password);
  return json({ reauthenticatedAt: ctx.reauthenticatedAt, csrf: await getCsrf(event) });
};
