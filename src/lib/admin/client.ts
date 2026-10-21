import { writable } from 'svelte/store';

interface ClientDependencies {
  fetch: typeof fetch;
  now: () => number;
  csrf: () => string;
  busy: (count: number) => void;
  unauthorized: (status: number) => void;
  refreshError?: (message: string | null) => void;
}

export function createAdminClient(deps: ClientDependencies) {
  const cache = new Map<string, { value: unknown; fetchedAt: number }>();
  const inFlight = new Map<string, { work: Promise<unknown>; background: boolean }>();
  const subscribers = new Map<string, Set<(value: any) => void>>();
  const pending = new Set<symbol>();
  let scope = '';
  let generation = 0;
  let identity = 0;

  const usable = (entry: { fetchedAt: number }) => deps.now() - entry.fetchedAt < 300_000;
  function invalidate() { generation++; cache.clear(); inFlight.clear(); deps.refreshError?.(null); }
  function setScope(next: string) {
    if (next === scope) return;
    scope = next; identity++; invalidate(); pending.clear(); deps.busy(0);
  }
  function subscribe<T = any>(path: string, callback: (value: T) => void) {
    let listeners = subscribers.get(path);
    if (!listeners) subscribers.set(path, listeners = new Set());
    listeners.add(callback);
    const entry = cache.get(path);
    if (entry && usable(entry)) callback(structuredClone(entry.value) as T);
    return () => {
      listeners.delete(callback);
      if (!listeners.size) subscribers.delete(path);
    };
  }
  async function foreground<T>(work: Promise<T>): Promise<T> {
    const ticket = Symbol(); pending.add(ticket); deps.busy(pending.size);
    try { return await work; }
    finally { pending.delete(ticket); deps.busy(pending.size); }
  }
  async function load(path: string, body: unknown, background = false): Promise<unknown> {
    const read = body === undefined;
    const cacheable = read && path.startsWith('api/') && Boolean(scope);
    if (cacheable) {
      const existing = inFlight.get(path);
      if (existing) return !background && existing.background ? foreground(existing.work) : existing.work;
    }
    const version = generation;
    const owner = identity;
    const work = (async () => {
      try {
        const response = await deps.fetch(`/admin/${path}`, {
          method: read ? 'GET' : 'POST', cache: 'no-store', credentials: 'same-origin',
          headers: read ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': deps.csrf() },
          body: read ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000)
        });
        if (owner !== identity) throw new Error('Administrator session changed. Refresh and retry.');
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) { invalidate(); deps.unauthorized(response.status); }
          const value = await response.json().catch(() => ({}));
          if (owner !== identity) throw new Error('Administrator session changed. Refresh and retry.');
          throw new Error(value.message || 'Request failed. Refresh and retry.');
        }
        const value = await response.json();
        if (owner !== identity) throw new Error('Administrator session changed. Refresh and retry.');
        if (cacheable && owner === identity && version === generation) {
          if (!cache.has(path) && cache.size >= 20) cache.delete(cache.keys().next().value!);
          cache.set(path, { value: structuredClone(value), fetchedAt: deps.now() });
          if (background) deps.refreshError?.(null);
          for (const callback of subscribers.get(path) ?? []) callback(structuredClone(value));
        }
        return value;
      } catch (error) {
        if (background && owner === identity && version === generation) {
          deps.refreshError?.('Could not refresh administrator data. Showing previously loaded data.');
        }
        throw error;
      } finally {
        if (!read && owner === identity) invalidate();
      }
    })();
    const tracked = work.finally(() => { if (inFlight.get(path)?.work === tracked) inFlight.delete(path); });
    if (cacheable) inFlight.set(path, { work: tracked, background });
    return background ? tracked : foreground(tracked);
  }
  async function request<T = any>(path: string, body?: unknown, options: { fresh?: boolean } = {}): Promise<T> {
    const read = body === undefined;
    if (!read || options.fresh) invalidate();
    if (read && path.startsWith('api/') && scope) {
      const hit = cache.get(path);
      if (hit && usable(hit)) {
        if (deps.now() - hit.fetchedAt >= 30_000) void load(path, undefined, true).catch(() => {});
        return structuredClone(hit.value) as T;
      }
    }
    return structuredClone(await load(path, body)) as T;
  }
  async function revalidateQueries() {
    await Promise.allSettled([...subscribers.keys()].filter(path => cache.has(path)).map(path => {
      return load(path, undefined, usable(cache.get(path)!));
    }));
  }
  function hasPageData(path: string) {
    const prefix = path === '/admin' ? 'api/overview' : path === '/admin/users' ? 'api/users?' : path === '/admin/audit' ? 'api/audit?' : `api${path.slice('/admin'.length)}`;
    return Boolean(scope) && [...cache].some(([key, entry]) => (key === prefix || key.startsWith(prefix)) && usable(entry));
  }
  return { request, invalidate, setScope, hasPageData, subscribe, revalidateQueries };
}

export const adminLoading = writable(0);
export const adminRefreshError = writable<string | null>(null);
export const getAdminCsrfToken = () => typeof document === 'undefined' ? '' : decodeURIComponent(document.cookie.split('; ').find(c => c.startsWith('cse_admin_csrf='))?.slice('cse_admin_csrf='.length) ?? '');
const client = createAdminClient({
  fetch: (...args) => fetch(...args), now: Date.now,
  csrf: getAdminCsrfToken,
  busy: count => adminLoading.set(count),
  refreshError: message => adminRefreshError.set(message),
  unauthorized: status => { if (status === 401 && typeof window !== 'undefined') window.location.replace('/admin/login'); }
});
export const adminRequest = client.request;
export const invalidateAdminCache = client.invalidate;
export const setAdminCacheScope = client.setScope;
export const hasAdminPageCache = client.hasPageData;
export const watchAdminQuery = client.subscribe;
export const revalidateAdminQueries = client.revalidateQueries;
