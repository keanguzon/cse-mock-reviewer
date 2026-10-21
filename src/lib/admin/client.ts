import { QueryClient, QueryObserver, isCancelledError, type Query } from '@tanstack/query-core';
import { writable } from 'svelte/store';

interface ClientDependencies {
  fetch: typeof fetch;
  csrf: () => string;
  busy: (count: number) => void;
  unauthorized: (status: number) => void;
  refreshError?: (message: string | null) => void;
  canRequest?: () => boolean;
}

const refreshFailure = 'Could not refresh administrator data. Showing previously loaded data.';
const sessionChanged = () => new Error('Administrator session changed. Refresh and retry.');
const pageRead = (path: string) => path.startsWith('api/') && !path.includes('/selections/');
const matchesPrefix = (path: string, prefix: string) => prefix.endsWith('?')
  ? path === prefix.slice(0, -1) || path.startsWith(prefix)
  : path === prefix || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}/`);

export function createAdminClient(deps: ClientDependencies) {
  const queries = new QueryClient({ defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 300_000, retry: false, networkMode: 'always', refetchOnWindowFocus: false, refetchOnReconnect: false },
    mutations: { retry: false }
  } });
  const subscribers = new Set<{ path: string; observer: QueryObserver<unknown, Error, unknown, unknown, readonly ['admin', string, string]> }>();
  const pending = new Set<symbol>();
  let scope = '';
  let identity = 0;
  let session = new AbortController();
  const key = (path: string) => ['admin', scope, path] as const;
  const pathOf = (query: Query) => String(query.queryKey[2] ?? '');

  function invalidate(prefix?: string) {
    const predicate = (query: Query) => query.queryKey[0] === 'admin' && (!prefix || matchesPrefix(pathOf(query), prefix));
    void queries.cancelQueries({ predicate });
    queries.removeQueries({ predicate });
    for (const subscription of subscribers) {
      if (!prefix || matchesPrefix(subscription.path, prefix)) subscription.observer.setOptions(observerOptions(subscription.path));
    }
    deps.refreshError?.(null);
  }
  function setScope(next: string) {
    if (next === scope) return;
    identity++;
    session.abort();
    session = new AbortController();
    scope = next;
    invalidate();
    pending.clear();
    deps.busy(0);
  }
  async function transport(path: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
    if (deps.canRequest && !deps.canRequest()) throw new Error('Administrator requests are only available in the browser.');
    const owner = identity;
    const combined = AbortSignal.any([session.signal, AbortSignal.timeout(30_000), ...(signal ? [signal] : [])]);
    const response = await deps.fetch(`/admin/${path}`, {
      method: body === undefined ? 'GET' : 'POST', cache: 'no-store', credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': deps.csrf() },
      body: body === undefined ? undefined : JSON.stringify(body), signal: combined
    });
    if (owner !== identity) throw sessionChanged();
    if (combined.aborted) throw combined.reason;
    const value = await response.json().catch(error => { if (response.ok) throw error; return {}; });
    if (owner !== identity) throw sessionChanged();
    if (combined.aborted) throw combined.reason;
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) { invalidate(); deps.unauthorized(response.status); }
      throw new Error(value.message || 'Request failed. Refresh and retry.');
    }
    return value;
  }
  const queryOptions = (path: string) => ({ queryKey: key(path), queryFn: ({ signal }: { signal: AbortSignal }) => transport(path, undefined, signal) });
  const observerOptions = (path: string) => ({ ...queryOptions(path), enabled: false });
  function subscribe<T = any>(path: string, callback: (value: T) => void) {
    const observer = new QueryObserver(queries, observerOptions(path));
    const subscription = { path, observer };
    subscribers.add(subscription);
    let last: unknown;
    const publish = (result: ReturnType<typeof observer.getCurrentResult>) => {
      if (scope && result.data !== undefined && result.data !== last) {
        last = result.data;
        callback(structuredClone(result.data) as T);
      }
    };
    const unsubscribe = observer.subscribe(publish);
    publish(observer.getCurrentResult());
    return () => { unsubscribe(); observer.destroy(); subscribers.delete(subscription); };
  }
  async function foreground<T>(work: Promise<T>): Promise<T> {
    const ticket = Symbol();
    pending.add(ticket); deps.busy(pending.size);
    try { return await work; }
    finally { if (pending.delete(ticket)) deps.busy(pending.size); }
  }
  function trimInactive() {
    const all = queries.getQueryCache().getAll();
    const inactive = all.filter(query => query.getObserversCount() === 0 && query.state.fetchStatus === 'idle').sort((a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt);
    let count = all.length;
    for (const query of inactive) {
      if (count <= 20) break;
      queries.removeQueries({ queryKey: query.queryKey, exact: true });
      count--;
    }
  }
  async function fetchQuery(path: string, background: boolean) {
    const owner = identity;
    try {
      const value = await queries.fetchQuery({ ...queryOptions(path), staleTime: 0 });
      if (background && owner === identity) deps.refreshError?.(null);
      trimInactive();
      return value;
    } catch (error) {
      if (owner !== identity) throw sessionChanged();
      if (background && !isCancelledError(error) && queries.getQueryData(key(path)) !== undefined) deps.refreshError?.(refreshFailure);
      throw error;
    }
  }
  function affectedPaths(path: string, body: unknown): string[] {
    if (/^api\/operations\/[^/]+\/retry$/.test(path)) return ['api/'];
    const match = /^api\/users\/([^/]+)\/(delete-attempts|delete-account|reset)$/.exec(path);
    if (!match || (match[2] === 'reset' && (body as { action?: string } | null)?.action !== 'execute')) return [];
    return [`api/users/${match[1]}`, 'api/overview', 'api/users?', 'api/audit?'];
  }
  function invalidateAffected(paths: string[]) {
    for (const path of paths) path === 'api/' ? invalidate() : invalidate(path);
  }
  async function request<T = any>(path: string, body?: unknown, options: { fresh?: boolean; quiet?: boolean } = {}): Promise<T> {
    if (body !== undefined) {
      const affected = affectedPaths(path, body);
      const owner = identity;
      invalidateAffected(affected);
      try { return structuredClone(await transport(path, body)) as T; }
      finally { if (owner === identity) invalidateAffected(affected); }
    }
    if (!pageRead(path) || !scope) return structuredClone(await transport(path)) as T;
    if (options.fresh) invalidate(path);
    const cached = queries.getQueryData(key(path));
    if (cached !== undefined) {
      const query = queries.getQueryCache().find({ queryKey: key(path), exact: true });
      if (query?.isStaleByTime(30_000)) void fetchQuery(path, true).catch(() => {});
      return structuredClone(cached) as T;
    }
    const work = fetchQuery(path, false);
    return structuredClone(await (options.quiet ? work : foreground(work))) as T;
  }
  async function revalidateQueries() {
    const paths = new Set([...subscribers].map(subscription => subscription.path));
    await Promise.allSettled([...paths].filter(path => queries.getQueryData(key(path)) !== undefined).map(path => fetchQuery(path, true)));
  }
  function hasPageData(path: string) {
    if (!scope) return false;
    const prefix = path === '/admin' ? 'api/overview' : path === '/admin/users' ? 'api/users?' : path === '/admin/audit' ? 'api/audit?' : `api${path.slice('/admin'.length)}`;
    return queries.getQueryCache().getAll().some(query => query.queryKey[1] === scope && matchesPrefix(pathOf(query), prefix) && query.state.data !== undefined);
  }
  return { request, invalidate, setScope, hasPageData, subscribe, revalidateQueries, queryClient: queries };
}

export const adminLoading = writable(0);
export const adminRefreshError = writable<string | null>(null);
export const getAdminCsrfToken = () => typeof document === 'undefined' ? '' : decodeURIComponent(document.cookie.split('; ').find(c => c.startsWith('cse_admin_csrf='))?.slice('cse_admin_csrf='.length) ?? '');
const client = createAdminClient({
  fetch: (...args) => fetch(...args),
  canRequest: () => typeof window !== 'undefined',
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

export const adminQueryClient = client.queryClient;

