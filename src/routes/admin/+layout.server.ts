import { requireAdmin, getCsrf } from '$lib/server/admin/session';
import { hashToken } from '$lib/server/admin/crypto';
import type { LayoutServerLoad } from './$types';
export const load: LayoutServerLoad = async event => {
  if (event.url.pathname === '/admin/login') return { admin: null };
  const admin = event.locals.admin ?? await requireAdmin(event);
  return { admin: { id: admin.adminId }, cacheScope: hashToken(admin.sessionId), csrf: await getCsrf(event) };
};
