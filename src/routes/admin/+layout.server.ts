import { requireAdmin, getCsrf } from '$lib/server/admin/session';
import type { LayoutServerLoad } from './$types';
export const load: LayoutServerLoad = async event => {
  if (event.url.pathname === '/admin/login') return { admin: null };
  const admin = await requireAdmin(event);
  return { admin: { id: admin.adminId }, csrf: await getCsrf(event) };
};
