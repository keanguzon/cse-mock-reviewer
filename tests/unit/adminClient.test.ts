import { describe, expect, it, vi } from 'vitest';
import { createAdminClient } from '../../src/lib/admin/client';

function fixture() {
  let now = 0;
  const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ count: 1 }));
  const busy = vi.fn();
  const unauthorized = vi.fn();
  const client = createAdminClient({ fetch: fetcher as typeof fetch, now: () => now, csrf: () => 'csrf', busy, unauthorized });
  client.setScope('session-a');
  return { client, fetcher, busy, unauthorized, advance: () => { now += 30_001; } };
}

describe('admin memory cache', () => {
  it('serves warm data without a loading state, isolates mutable results, and expires after thirty seconds', async () => {
    const f = fixture();
    const first = await f.client.request<{ count: number }>('api/overview');
    first.count = 99;
    f.busy.mockClear();
    expect(await f.client.request('api/overview')).toEqual({ count: 1 });
    expect(f.fetcher).toHaveBeenCalledOnce();
    expect(f.busy).not.toHaveBeenCalled();
    f.advance();
    await f.client.request('api/overview');
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    expect(f.fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store', credentials: 'same-origin' });
  });

  it('deduplicates concurrent cold reads and clears the indicator on network or JSON failure', async () => {
    const f = fixture();
    let resolve!: (value: Response) => void;
    f.fetcher.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const a = f.client.request('api/users');
    const b = f.client.request('api/users');
    expect(f.fetcher).toHaveBeenCalledOnce();
    resolve(Response.json({ count: 2 }));
    await Promise.all([a, b]);
    expect(f.busy).toHaveBeenLastCalledWith(0);
    f.fetcher.mockRejectedValueOnce(new Error('offline'));
    await expect(f.client.request('api/audit')).rejects.toThrow('offline');
    expect(f.busy).toHaveBeenLastCalledWith(0);
    f.fetcher.mockResolvedValueOnce(new Response('broken JSON'));
    await expect(f.client.request('api/audit')).rejects.toThrow();
    expect(f.busy).toHaveBeenLastCalledWith(0);
  });

  it('invalidates before and after mutations so stale in-flight reads cannot repopulate the cache', async () => {
    const f = fixture();
    let resolve!: (value: Response) => void;
    f.fetcher.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const stale = f.client.request('api/overview');
    await f.client.request('api/users/id/reset', {});
    resolve(Response.json({ count: 50 }));
    await stale;
    expect(await f.client.request('api/overview')).toEqual({ count: 1 });
    expect(f.fetcher).toHaveBeenCalledTimes(3);
  });

  it('refreshes on demand and clears cache on logout, session switch and denied access', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    await f.client.request('api/overview', undefined, { fresh: true });
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    f.client.setScope('session-b');
    await f.client.request('api/overview');
    f.fetcher.mockResolvedValueOnce(Response.json({ message: 'Access denied' }, { status: 403 }));
    await expect(f.client.request('api/users')).rejects.toThrow('Access denied');
    expect(f.unauthorized).toHaveBeenCalledWith(403);
    await f.client.request('api/overview');
    expect(f.fetcher).toHaveBeenCalledTimes(5);
    f.client.setScope('');
    await f.client.request('api/overview');
    await f.client.request('api/overview');
    expect(f.fetcher).toHaveBeenCalledTimes(7);
  });

  it('rejects a response parsed after an admin session switch and bounds retained entries', async () => {
    const f = fixture();
    let finish!: (value: unknown) => void;
    f.fetcher.mockResolvedValueOnce({ ok: true, json: () => new Promise(resolve => { finish = resolve; }) } as Response);
    const previous = f.client.request('api/overview');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    f.client.setScope('session-b');
    finish({ count: 100 });
    await expect(previous).rejects.toThrow('session changed');
    for (let n = 0; n < 21; n++) await f.client.request(`api/users?page=${n}`);
    await f.client.request('api/users?page=0');
    expect(f.fetcher).toHaveBeenCalledTimes(23);
  });
});
