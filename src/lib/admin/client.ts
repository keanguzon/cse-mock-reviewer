import { writable } from 'svelte/store';

interface ClientDependencies {
  fetch: typeof fetch;
  now: () => number;
  csrf: () => string;
  busy: (count: number) => void;
  unauthorized: (status: number) => void;
}

export function createAdminClient(deps: ClientDependencies) {
  const cache = new Map<string, { value: unknown; expires: number }>();
  const inFlight = new Map<string, Promise<unknown>>();
  const pending = new Set<symbol>();
  let scope = '';
  let generation = 0;
  let identity = 0;

  function invalidate() { generation++; cache.clear(); inFlight.clear(); }
  function setScope(next: string) {
    if (next === scope) return;
    scope = next; identity++; invalidate(); pending.clear(); deps.busy(0);
  }
  async function request<T = any>(path: string, body?: unknown, options: { fresh?: boolean } = {}): Promise<T> {
    const read = body === undefined;
    const cacheable = read && path.startsWith('api/') && Boolean(scope);
    if (!read || options.fresh) invalidate();
    if (cacheable) {
      const hit = cache.get(path);
      if (hit && hit.expires > deps.now()) return structuredClone(hit.value) as T;
      const existing = inFlight.get(path);
      if (existing) return structuredClone(await existing) as T;
    }
    const version = generation;
    const owner = identity;
    const ticket = Symbol(); pending.add(ticket); deps.busy(pending.size);
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
          throw new Error(value.message || 'Request failed. Refresh and retry.');
        }
        const value = await response.json();
        if (owner !== identity) throw new Error('Administrator session changed. Refresh and retry.');
        if (cacheable && owner === identity && version === generation) {
          if (cache.size >= 20) cache.delete(cache.keys().next().value!);
          cache.set(path, { value: structuredClone(value), expires: deps.now() + 30_000 });
        }
        return value;
      } finally {
        if (!read && owner === identity) invalidate();
        pending.delete(ticket); deps.busy(pending.size);
      }
    })();
    if (cacheable) inFlight.set(path, work);
    try { return structuredClone(await work) as T; }
    finally { if (inFlight.get(path) === work) inFlight.delete(path); }
  }
  function hasPageData(path: string) {
    const prefix = path === '/admin' ? 'api/overview' : path === '/admin/users' ? 'api/users?' : path === '/admin/audit' ? 'api/audit?' : `api${path.slice('/admin'.length)}`;
    return Boolean(scope) && [...cache].some(([key, entry]) => (key === prefix || key.startsWith(prefix)) && entry.expires > deps.now());
  }
  return { request, invalidate, setScope, hasPageData };
}

export const adminLoading = writable(0);
const client = createAdminClient({
  fetch: (...args) => fetch(...args), now: Date.now,
  csrf: () => typeof document === 'undefined' ? '' : decodeURIComponent(document.cookie.split('; ').find(c => c.startsWith('cse_admin_csrf='))?.slice('cse_admin_csrf='.length) ?? ''),
  busy: count => adminLoading.set(count),
  unauthorized: status => { if (status === 401 && typeof window !== 'undefined') window.location.replace('/admin/login'); }
});
export const adminRequest = client.request;
export const invalidateAdminCache = client.invalidate;
export const setAdminCacheScope = client.setScope;
export const hasAdminPageCache = client.hasPageData;
