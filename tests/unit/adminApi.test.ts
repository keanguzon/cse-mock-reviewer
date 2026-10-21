import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
const mocks = vi.hoisted(() => ({ call: vi.fn(), mutation: vi.fn() }));
vi.mock('../../src/lib/server/admin/session', () => ({ requireAdmin: async () => ({ adminId: 'actor', sessionId: 'session' }), requireAdminMutation: mocks.mutation }));
vi.mock('../../src/lib/server/admin/service', () => ({ adminCall: mocks.call }));
vi.mock('../../src/lib/server/admin/accountDeletion', () => ({ runAccountDeletion: vi.fn() }));
import { GET, POST } from '../../src/routes/admin/api/[...path]/+server';
const user = '00000000-0000-4000-8000-000000000002';
const selection = '00000000-0000-4000-8000-000000000003';
function event(path: string, payload?: unknown) {
  const url = new URL(`https://reviewer.example/admin/api/${path}`);
  return { url, params: { path: url.pathname.slice('/admin/api/'.length) }, request: new Request(url, payload === undefined ? {} : { method: 'POST', body: JSON.stringify(payload), headers: { 'content-type': 'application/json' } }) } as unknown as RequestEvent;
}
describe('admin request boundaries', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.call.mockResolvedValue({ items: [] }); });
  it('omits blank optional filters instead of sending invalid empty dates or UUIDs', async () => {
    await GET(event(`users/${user}/attempts?from=&to=&category=&mode=all`));
    expect(mocks.call).toHaveBeenCalledWith('attempts', { userId: user, filter: { mode: 'all' } }, expect.anything());
    await GET(event('audit?action=&status=&targetId=&page=1'));
    expect(mocks.call).toHaveBeenLastCalledWith('audit', { page: '1' }, expect.anything());
  });
  it('revalidates frozen selections before showing the confirmation', async () => {
    await GET(event(`users/${user}/selections/${selection}`));
    expect(mocks.call).toHaveBeenCalledWith('selection_get', { userId: user, selectionId: selection }, expect.anything());
  });
  it('rejects extra mutation path segments and malformed identifiers', async () => {
    await expect(POST(event(`users/${user}/reset/extra`, {}))).rejects.toMatchObject({ status: 404 });
    await expect(GET(event('users/invalid'))).rejects.toMatchObject({ status: 400 });
    expect(mocks.call).not.toHaveBeenCalled();
  });
  it('caps the consumed body before JSON parsing or database calls', async () => {
    await expect(POST(event(`users/${user}/selections`, { padding: 'x'.repeat(1024 * 1024) }))).rejects.toMatchObject({ status: 413 });
    expect(mocks.mutation).toHaveBeenCalledOnce();
    expect(mocks.call).not.toHaveBeenCalled();
  });
});
