import { describe, expect, it, vi } from 'vitest';
import { createAdminClient } from '../../src/lib/admin/client';

function fixture() {
  let now = 0;
  const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ count: 1 }));
  const busy = vi.fn();
  const unauthorized = vi.fn();
  const refreshError = vi.fn();
  const client = createAdminClient({ fetch: fetcher as typeof fetch, now: () => now, csrf: () => 'csrf', busy, unauthorized, refreshError });
  client.setScope('session-a');
  return { client, fetcher, busy, unauthorized, refreshError, advance: (duration = 30_001) => { now += duration; } };
}

describe('admin memory cache', () => {
  it('returns stale data immediately, deduplicates background refresh, and publishes cloned fresh results without a spinner', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    f.advance();
    const first = vi.fn((value: { count: number }) => { value.count = 999; });
    const second = vi.fn();
    f.client.subscribe('api/overview', first);
    f.client.subscribe('api/overview', second);
    let resolve!: (response: Response) => void;
    f.fetcher.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    f.busy.mockClear();
    expect(await f.client.request('api/overview')).toEqual({ count: 1 });
    expect(await f.client.request('api/overview')).toEqual({ count: 1 });
    expect(f.client.hasPageData('/admin')).toBe(true);
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    expect(f.busy).not.toHaveBeenCalled();
    resolve(Response.json({ count: 2 }));
    await vi.waitFor(() => expect(second).toHaveBeenLastCalledWith({ count: 2 }));
    expect(await f.client.request('api/overview')).toEqual({ count: 2 });
    expect(f.busy).not.toHaveBeenCalled();
  });

  it('blocks with a foreground indicator once data is five minutes old', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    f.advance(300_000);
    expect(f.client.hasPageData('/admin')).toBe(false);
    let resolve!: (response: Response) => void;
    f.fetcher.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    f.busy.mockClear();
    let settled = false;
    const request = f.client.request('api/overview').then(value => { settled = true; return value; });
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(f.busy).toHaveBeenLastCalledWith(1);
    resolve(Response.json({ count: 3 }));
    expect(await request).toEqual({ count: 3 });
    expect(f.busy).toHaveBeenLastCalledWith(0);
  });

  it('joins an unfinished background refresh with a foreground indicator after stale data expires', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    f.advance(299_999);
    let resolve!: (response: Response) => void;
    f.fetcher.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await f.client.request('api/overview');
    f.advance(1);
    f.busy.mockClear();
    const waiting = f.client.request('api/overview');
    expect(f.busy).toHaveBeenLastCalledWith(1);
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    resolve(Response.json({ count: 6 }));
    expect(await waiting).toEqual({ count: 6 });
    expect(f.busy).toHaveBeenLastCalledWith(0);
  });

  it.each([401, 403])('clears stale data and reports background denied access (%s)', async status => {
    const f = fixture();
    await f.client.request('api/overview');
    f.advance();
    f.fetcher.mockResolvedValueOnce(Response.json({ message: 'Denied' }, { status }));
    await f.client.request('api/overview');
    await vi.waitFor(() => expect(f.unauthorized).toHaveBeenCalledWith(status));
    expect(f.client.hasPageData('/admin')).toBe(false);
    await f.client.request('api/overview');
    expect(f.fetcher).toHaveBeenCalledTimes(3);
  });

  it.each(['network', 'json', 'server'])('retains stale data after a background %s failure and retries safely', async kind => {
    const f = fixture();
    await f.client.request('api/overview');
    f.advance();
    if (kind === 'network') f.fetcher.mockRejectedValueOnce(new Error('private network details'));
    if (kind === 'json') f.fetcher.mockResolvedValueOnce(new Response('private invalid JSON'));
    if (kind === 'server') f.fetcher.mockResolvedValueOnce(Response.json({ message: 'private server details' }, { status: 500 }));
    expect(await f.client.request('api/overview')).toEqual({ count: 1 });
    await vi.waitFor(() => expect(f.refreshError).toHaveBeenLastCalledWith('Could not refresh administrator data. Showing previously loaded data.'));
    f.fetcher.mockResolvedValueOnce(Response.json({ count: 4 }));
    expect(await f.client.request('api/overview')).toEqual({ count: 1 });
    await vi.waitFor(() => expect(f.refreshError).toHaveBeenLastCalledWith(null));
    expect(await f.client.request('api/overview')).toEqual({ count: 4 });
  });

  it('revalidates only subscribed cached paths and respects unsubscribe', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    await f.client.request('api/users');
    const listener = vi.fn();
    const unsubscribe = f.client.subscribe('api/overview', listener);
    f.client.subscribe('api/missing', vi.fn());
    f.busy.mockClear();
    await Promise.all([f.client.revalidateQueries(), f.client.revalidateQueries()]);
    expect(f.fetcher).toHaveBeenCalledTimes(3);
    expect(f.fetcher).toHaveBeenLastCalledWith('/admin/api/overview', expect.anything());
    expect(f.busy).not.toHaveBeenCalled();
    const calls = listener.mock.calls.length;
    unsubscribe();
    await f.client.revalidateQueries();
    expect(f.fetcher).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenCalledTimes(calls);
  });

  it('does not publish background results or errors after mutation invalidation or a session switch', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    f.advance();
    const listener = vi.fn();
    f.client.subscribe('api/overview', listener);
    listener.mockClear();
    let finish!: (value: unknown) => void;
    f.fetcher.mockResolvedValueOnce({ ok: true, json: () => new Promise(resolve => { finish = resolve; }) } as Response);
    await f.client.request('api/overview');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    await f.client.request('api/users/id/reset', {});
    finish({ count: 100 });
    await Promise.resolve();
    await Promise.resolve();
    expect(listener).not.toHaveBeenCalled();
    await f.client.request('api/overview');
    f.advance();
    let reject!: (error: Error) => void;
    f.fetcher.mockImplementationOnce(() => new Promise((_done, fail) => { reject = fail; }));
    await f.client.request('api/overview');
    f.client.setScope('session-b');
    f.refreshError.mockClear();
    reject(new Error('old session failure'));
    await Promise.resolve();
    await Promise.resolve();
    expect(f.refreshError).not.toHaveBeenCalled();
  });

  it('serves warm data without a loading state, isolates mutable results, and revalidates after thirty seconds', async () => {
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

  it('manual refresh bypasses stale data with a foreground indicator and unsubscribed callbacks stay silent', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    const listener = vi.fn();
    const unsubscribe = f.client.subscribe('api/overview', listener);
    listener.mockClear();
    let resolve!: (response: Response) => void;
    f.fetcher.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    f.busy.mockClear();
    const request = f.client.request('api/overview', undefined, { fresh: true });
    expect(f.busy).toHaveBeenLastCalledWith(1);
    unsubscribe();
    resolve(Response.json({ count: 5 }));
    expect(await request).toEqual({ count: 5 });
    expect(f.busy).toHaveBeenLastCalledWith(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('does not extend stale retention on failure or publish a background JSON result across identities', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    f.advance();
    f.fetcher.mockRejectedValueOnce(new Error('offline'));
    await f.client.request('api/overview');
    await vi.waitFor(() => expect(f.refreshError).toHaveBeenLastCalledWith(expect.any(String)));
    f.advance(269_999);
    f.fetcher.mockRejectedValueOnce(new Error('still offline'));
    await expect(f.client.request('api/overview')).rejects.toThrow('still offline');
    expect(f.client.hasPageData('/admin')).toBe(false);
    await f.client.request('api/overview');
    f.advance();
    let finish!: (value: unknown) => void;
    f.fetcher.mockResolvedValueOnce({ ok: true, json: () => new Promise(resolve => { finish = resolve; }) } as Response);
    const listener = vi.fn();
    f.client.subscribe('api/overview', listener);
    listener.mockClear();
    await f.client.request('api/overview');
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    f.client.setScope('session-b');
    f.refreshError.mockClear();
    finish({ count: 100 });
    await Promise.resolve();
    await Promise.resolve();
    expect(listener).not.toHaveBeenCalled();
    expect(f.refreshError).not.toHaveBeenCalled();
    expect(f.client.hasPageData('/admin')).toBe(false);
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
