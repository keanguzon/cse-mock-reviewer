import { redirect } from '@sveltejs/kit';
import { logoutAdmin } from '$lib/server/admin/session';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
  await logoutAdmin(event);
  redirect(303, '/admin/login');
};
