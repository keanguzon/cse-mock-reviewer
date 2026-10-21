import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminClient } from '../../src/lib/admin/client';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-01-01')); });
afterEach(() => vi.useRealTimers());

function fixture() {
  const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ count: 1 }));
  const busy = vi.fn();
  const unauthorized = vi.fn();
  const refreshError = vi.fn();
  const client = createAdminClient({ fetch: fetcher as typeof fetch, csrf: () => 'csrf', busy, unauthorized, refreshError });
  client.setScope('session-a');
  return { client, fetcher, busy, unauthorized, refreshError, advance: (duration = 30_001) => vi.advanceTimersByTimeAsync(duration) };
}
const flush = async () => { for (let n = 0; n < 15; n++) await Promise.resolve(); };

describe('TanStack administrator query cache', () => {
  it('deduplicates cold reads, clones results, and tracks initial loading', async () => {
    const f = fixture();
    let finish!: (value: Response) => void;
    f.fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const a = f.client.request('api/overview');
    const b = f.client.request('api/overview');
    expect(f.fetcher).toHaveBeenCalledOnce();
    expect(f.busy).toHaveBeenLastCalledWith(2);
    finish(Response.json({ count: 2 }));
    const [first, second] = await Promise.all([a, b]);
    first.count = 99;
    expect(second).toEqual({ count: 2 });
    expect(await f.client.request('api/overview')).toEqual({ count: 2 });
    expect(f.busy).toHaveBeenLastCalledWith(0);
  });

  it('returns stale data immediately, deduplicates refresh, and publishes cloned results without a spinner', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    await f.advance();
    const first = vi.fn((value: { count: number }) => { value.count = 999; });
    const second = vi.fn();
    f.client.subscribe('api/overview', first);
    f.client.subscribe('api/overview', second);
    let finish!: (response: Response) => void;
    f.fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    f.busy.mockClear();
    expect(await f.client.request('api/overview')).toEqual({ count: 1 });
    expect(await f.client.request('api/overview')).toEqual({ count: 1 });
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    expect(f.busy).not.toHaveBeenCalled();
    finish(Response.json({ count: 2 }));
    await flush();
    expect(second).toHaveBeenLastCalledWith({ count: 2 });
    expect(await f.client.request('api/overview')).toEqual({ count: 2 });
  });

  it('collects unobserved data after five minutes of inactivity', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    await f.advance(300_000);
    expect(f.client.hasPageData('/admin')).toBe(false);
    f.busy.mockClear();
    await f.client.request('api/overview');
    expect(f.busy).toHaveBeenCalledWith(1);
    expect(f.fetcher).toHaveBeenCalledTimes(2);
  });

  it('retains observed data beyond five minutes and starts collection on unsubscribe', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    const unsubscribe = f.client.subscribe('api/overview', vi.fn());
    await f.advance(600_000);
    expect(f.client.hasPageData('/admin')).toBe(true);
    unsubscribe();
    await f.advance(299_999);
    expect(f.client.hasPageData('/admin')).toBe(true);
    await f.advance(1);
    expect(f.client.hasPageData('/admin')).toBe(false);
  });

  it.each([401, 403])('clears cached data and reports background denied access (%s)', async status => {
    const f = fixture();
    await f.client.request('api/overview');
    await f.advance();
    f.fetcher.mockResolvedValueOnce(Response.json({ message: 'Denied' }, { status }));
    await f.client.request('api/overview');
    await flush();
    expect(f.unauthorized).toHaveBeenCalledWith(status);
    expect(f.client.hasPageData('/admin')).toBe(false);
  });

  it.each(['network', 'json', 'server'])('retains stale data and hides background %s details', async kind => {
    const f = fixture();
    await f.client.request('api/overview');
    await f.advance();
    if (kind === 'network') f.fetcher.mockRejectedValueOnce(new Error('private network details'));
    if (kind === 'json') f.fetcher.mockResolvedValueOnce(new Response('private invalid JSON'));
    if (kind === 'server') f.fetcher.mockResolvedValueOnce(Response.json({ message: 'private server details' }, { status: 500 }));
    expect(await f.client.request('api/overview')).toEqual({ count: 1 });
    await flush();
    expect(f.refreshError).toHaveBeenLastCalledWith('Could not refresh administrator data. Showing previously loaded data.');
    f.fetcher.mockResolvedValueOnce(Response.json({ count: 4 }));
    await f.client.request('api/overview');
    await flush();
    expect(f.refreshError).toHaveBeenLastCalledWith(null);
    expect(await f.client.request('api/overview')).toEqual({ count: 4 });
  });

  it('revalidates subscribed cached paths only and deduplicates concurrent revalidations', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    await f.client.request('api/users');
    const unsubscribe = f.client.subscribe('api/overview', vi.fn());
    f.client.subscribe('api/missing', vi.fn());
    f.busy.mockClear();
    await Promise.all([f.client.revalidateQueries(), f.client.revalidateQueries()]);
    expect(f.fetcher).toHaveBeenCalledTimes(3);
    expect(f.fetcher).toHaveBeenLastCalledWith('/admin/api/overview', expect.anything());
    expect(f.busy).not.toHaveBeenCalled();
    unsubscribe();
    await f.client.revalidateQueries();
    expect(f.fetcher).toHaveBeenCalledTimes(3);
  });

  it('refreshes the requested path only and keeps unsubscribed callbacks silent', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    await f.client.request('api/users?page=1');
    const listener = vi.fn();
    const unsubscribe = f.client.subscribe('api/overview', listener);
    listener.mockClear();
    unsubscribe();
    f.fetcher.mockResolvedValueOnce(Response.json({ count: 5 }));
    expect(await f.client.request('api/overview', undefined, { fresh: true })).toEqual({ count: 5 });
    expect(f.client.hasPageData('/admin/users')).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('aborts old session work and rejects JSON finishing after an identity switch', async () => {
    const f = fixture();
    let finish!: (value: unknown) => void;
    f.fetcher.mockResolvedValueOnce({ ok: true, json: () => new Promise(resolve => { finish = resolve; }) } as Response);
    const previous = f.client.request('api/overview');
    const rejected = expect(previous).rejects.toThrow('session changed');
    await flush();
    const signal = f.fetcher.mock.calls[0][1]!.signal!;
    f.client.setScope('session-b');
    expect(signal.aborted).toBe(true);
    finish({ count: 100 });
    await rejected;
    expect(f.client.hasPageData('/admin')).toBe(false);
    await f.client.request('api/overview');
    expect(f.fetcher).toHaveBeenCalledTimes(2);
  });

  it('suppresses old background failures after logout', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    await f.advance();
    let reject!: (error: Error) => void;
    f.fetcher.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    await f.client.request('api/overview');
    f.client.setScope('');
    f.refreshError.mockClear();
    reject(new Error('old private failure'));
    await flush();
    expect(f.refreshError).not.toHaveBeenCalled();
    expect(f.client.hasPageData('/admin')).toBe(false);
  });

  it('bounds inactive entries without evicting observed data', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    f.client.subscribe('api/overview', vi.fn());
    for (let n = 0; n < 21; n++) await f.client.request(`api/users?page=${n}`);
    expect(f.client.hasPageData('/admin')).toBe(true);
    await f.client.request('api/users?page=0');
    expect(f.fetcher).toHaveBeenCalledTimes(23);
  });

  it('does not retry failed reads or destructive POSTs and sends CSRF with no-store', async () => {
    const f = fixture();
    f.fetcher.mockRejectedValueOnce(new Error('offline'));
    await expect(f.client.request('api/overview')).rejects.toThrow('offline');
    f.fetcher.mockRejectedValueOnce(new Error('offline'));
    await expect(f.client.request('api/users/id/delete-attempts', {})).rejects.toThrow('offline');
    await f.advance(5_000);
    expect(f.fetcher).toHaveBeenCalledTimes(2);
    expect(f.busy).toHaveBeenLastCalledWith(0);
    expect(f.fetcher.mock.calls[1][1]).toMatchObject({ method: 'POST', cache: 'no-store', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf' } });
  });

  it('prevents network requests when configured for SSR', async () => {
    const f = fixture();
    const client = createAdminClient({ fetch: f.fetcher as typeof fetch, csrf: () => '', busy: vi.fn(), unauthorized: vi.fn(), canRequest: () => false });
    client.setScope('ssr');
    await expect(client.request('api/overview')).rejects.toThrow('browser');
    expect(f.fetcher).not.toHaveBeenCalled();
  });

  it('awaits quiet cold reads without the global loading indicator', async () => {
    const f = fixture();
    let finish!: (response: Response) => void;
    f.fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    f.busy.mockClear();
    let settled = false;
    const request = f.client.request('api/users/id', undefined, { quiet: true }).then(value => { settled = true; return value; });
    await flush();
    expect(settled).toBe(false);
    expect(f.busy).not.toHaveBeenCalled();
    finish(Response.json({ count: 2 }));
    expect(await request).toEqual({ count: 2 });
    expect(f.busy).not.toHaveBeenCalled();
  });
});
describe('targeted admin invalidation', () => {
  it('preserves page caches and avoids blocking through selection previews and reauthentication', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    for (const [path, body] of [
      ['api/users/id/selections', { kind: 'ids', ids: [] }],
      ['api/users/id/selections/selection/exclude', { ids: [] }],
      ['api/users/id/reset', { action: 'preview' }],
      ['reauth', { password: 'secret' }],
      ['api/users/id/selections/selection', undefined]
    ] as const) {
      f.busy.mockClear();
      await f.client.request(path, body);
      expect(f.client.hasPageData('/admin')).toBe(true);
      expect(f.busy).not.toHaveBeenCalled();
    }
    await f.client.request('api/overview');
    expect(f.fetcher).toHaveBeenCalledTimes(6);
  });

  it.each(['reset', 'delete-attempts', 'delete-account'])('invalidates affected data but preserves unrelated user detail after %s', async action => {
    const f = fixture();
    for (const path of ['api/users/other', 'api/users/id', 'api/users/id/attempts?page=1', 'api/overview', 'api/users?page=1', 'api/audit?page=1']) await f.client.request(path);
    await f.client.request(`api/users/id/${action}`, { action: 'execute' });
    expect(f.client.hasPageData('/admin/users/other')).toBe(true);
    for (const page of ['/admin/users/id', '/admin', '/admin/users', '/admin/audit']) expect(f.client.hasPageData(page)).toBe(false);
  });

  it('cancels affected reads before and after destructive work so late replies cannot resurrect data', async () => {
    const f = fixture();
    let first!: (response: Response) => void;
    let second!: (response: Response) => void;
    let mutation!: (response: Response) => void;
    f.fetcher.mockImplementationOnce(() => new Promise(resolve => { first = resolve; }));
    const before = f.client.request('api/overview');
    const rejectedBefore = expect(before).rejects.toThrow();
    f.fetcher.mockImplementationOnce(() => new Promise(resolve => { mutation = resolve; }));
    const change = f.client.request('api/users/id/reset', { action: 'execute' });
    expect(f.fetcher.mock.calls[0][1]!.signal!.aborted).toBe(true);
    f.fetcher.mockImplementationOnce(() => new Promise(resolve => { second = resolve; }));
    const during = f.client.request('api/overview');
    const rejectedDuring = expect(during).rejects.toThrow();
    mutation(Response.json({ status: 'succeeded' }));
    await change;
    expect(f.fetcher.mock.calls[2][1]!.signal!.aborted).toBe(true);
    first(Response.json({ count: 50 }));
    second(Response.json({ count: 60 }));
    await Promise.all([rejectedBefore, rejectedDuring]);
    expect(f.client.hasPageData('/admin')).toBe(false);
    expect(await f.client.request('api/overview')).toEqual({ count: 1 });
  });

  it('supports a manual path prefix and operation retry invalidates all pages', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    await f.client.request('api/users?page=1');
    f.client.invalidate('api/users?');
    expect(f.client.hasPageData('/admin/users')).toBe(false);
    expect(f.client.hasPageData('/admin')).toBe(true);
    await f.client.request('api/operations/operation/retry', {});
    expect(f.client.hasPageData('/admin')).toBe(false);
  });

  it('invalidates after a failed destructive POST and respects user ID boundaries', async () => {
    const f = fixture();
    await f.client.request('api/users/id-other');
    let finish!: (response: Response) => void;
    f.fetcher.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const mutation = f.client.request('api/users/id/delete-attempts', {});
    const rejected = expect(mutation).rejects.toThrow('Failed');
    await f.client.request('api/users/id');
    finish(Response.json({ message: 'Failed' }, { status: 500 }));
    await rejected;
    expect(f.client.hasPageData('/admin/users/id')).toBe(false);
    expect(f.client.hasPageData('/admin/users/id-other')).toBe(true);
  });

  it('does not publish JSON completing after destructive invalidation and observers reconnect to fresh reads', async () => {
    const f = fixture();
    await f.client.request('api/overview');
    const listener = vi.fn();
    f.client.subscribe('api/overview', listener);
    await f.advance();
    let parsed!: (value: unknown) => void;
    f.fetcher.mockResolvedValueOnce({ ok: true, json: () => new Promise(resolve => { parsed = resolve; }) } as Response);
    await f.client.request('api/overview');
    await flush();
    listener.mockClear();
    await f.client.request('api/users/id/reset', { action: 'execute' });
    parsed({ count: 100 });
    await flush();
    expect(listener).not.toHaveBeenCalled();
    expect(f.client.hasPageData('/admin')).toBe(false);
    f.fetcher.mockResolvedValueOnce(Response.json({ count: 3 }));
    await f.client.request('api/overview');
    expect(listener).toHaveBeenLastCalledWith({ count: 3 });
  });
});

