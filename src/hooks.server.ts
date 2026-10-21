import { isHttpError, type Handle } from '@sveltejs/kit';
import { requireAdmin, requireAdminMutation } from '$lib/server/admin/session';

function protectResponse(response: Response) {
  response = new Response(response.body, response);
  response.headers.set('cache-control', 'private, no-store');
  const vary = response.headers.get('vary')?.split(',').map(value => value.trim()) ?? [];
  if (!vary.some(value => value.toLowerCase() === 'cookie')) vary.push('Cookie');
  response.headers.set('vary', vary.join(', '));
  response.headers.set('content-security-policy', "frame-ancestors 'none'");
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('referrer-policy', 'same-origin');
  return response;
}

export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;
  if (path !== '/admin' && !path.startsWith('/admin/')) return resolve(event);
  const endpoint = path.startsWith('/admin/api/') || path === '/admin/reauth' || path === '/admin/logout';
  try {
    if (!['GET', 'HEAD', 'POST'].includes(event.request.method)) {
      return protectResponse(new Response('Method not allowed.', { status: 405, headers: { allow: 'GET, HEAD, POST' } }));
    }
    if (path !== '/admin/login' && path !== '/admin/login/__data.json') {
      const ctx = await requireAdmin(event);
      event.locals.admin = ctx;
      if (event.request.method === 'POST') await requireAdminMutation(event, ctx);
    }
    return protectResponse(await resolve(event));
  } catch (cause) {
    if (!isHttpError(cause)) throw cause;
    if (!endpoint && (cause.status === 401 || cause.status === 403)) {
      return protectResponse(new Response(null, { status: 303, headers: { location: '/admin/login' } }));
    }
    return protectResponse(Response.json({ message: cause.body.message }, { status: cause.status }));
  }
};
