import { error, json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import { requireAdmin, requireAdminMutation } from '$lib/server/admin/session';
import { adminCall } from '$lib/server/admin/service';
import { runAccountDeletion } from '$lib/server/admin/accountDeletion';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const id = (value: unknown): string => { if (typeof value !== 'string' || !uuid.test(value)) error(400, 'Invalid identifier.'); return value; };

export const GET: RequestHandler = async event => {
  const context = await requireAdmin(event);
  const parts = event.params.path?.split('/') ?? [];
  const query = Object.fromEntries([...event.url.searchParams].filter(([, value]) => value !== ''));
  if (parts.length === 1 && ['overview','users','audit'].includes(parts[0])) return json(await adminCall(parts[0], query, context));
  if (parts[0] === 'users' && parts.length === 2) return json(await adminCall('user', { userId: id(parts[1]) }, context));
  if (parts[0] === 'users' && parts.length === 3 && parts[2] === 'attempts') return json(await adminCall('attempts', { userId: id(parts[1]), filter: query }, context));
  if (parts[0] === 'users' && parts.length === 4 && parts[2] === 'selections') return json(await adminCall('selection_get', { userId: id(parts[1]), selectionId: id(parts[3]) }, context));
  error(404, 'Admin endpoint not found.');
};

async function body(event: RequestEvent): Promise<Record<string, any>> {
  const reader = event.request.body?.getReader();
  if (!reader) error(400, 'Invalid JSON request.');
  const decoder = new TextDecoder();
  let text = '', size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) { await reader.cancel(); error(413, 'Request too large.'); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  try { const value = JSON.parse(text); if (value && typeof value === 'object' && !Array.isArray(value)) return value; } catch { /* Invalid JSON receives the same public validation response. */ }
  error(400, 'Invalid JSON request.');
}

export const POST: RequestHandler = async event => {
  const context = await requireAdmin(event);
  await requireAdminMutation(event, context);
  const parts = event.params.path?.split('/') ?? [];
  const value = await body(event);
  if (parts[0] === 'operations' && parts.length === 3 && parts[2] === 'retry') return json(await runAccountDeletion(context, id(parts[1])));
  if (parts[0] !== 'users' || parts.length < 3) error(404, 'Admin endpoint not found.');
  const userId = id(parts[1]);
  const action = parts[2];
  if (action === 'selections' && parts.length === 3) {
    if (value.ids && (!Array.isArray(value.ids) || !value.ids.every((v: unknown) => typeof v === 'string' && uuid.test(v)))) error(400, 'Invalid selection.');
    return json(await adminCall('selection', { userId, kind: value.kind, ids: value.ids, filter: value.filter }, context));
  }
  if (action === 'selections' && parts.length === 5 && parts[4] === 'exclude') return json(await adminCall('exclude', { userId, selectionId: id(parts[3]), ids: value.ids }, context));
  if (action === 'delete-attempts' && parts.length === 3) return json(await adminCall('delete_attempts', { userId, selectionId: id(value.selectionId), operationId: id(value.operationId) }, context));
  if (action === 'reset' && parts.length === 3) {
    if (value.action === 'preview') return json(await adminCall('selection', { userId, kind: 'reset' }, context));
    return json(await adminCall('reset', { userId, selectionId: id(value.selectionId), operationId: id(value.operationId) }, context));
  }
  if (action === 'delete-account' && parts.length === 3) return json(await runAccountDeletion(context, id(value.operationId), { userId, typedEmail: String(value.typedEmail ?? '') }));
  error(404, 'Admin endpoint not found.');
};
