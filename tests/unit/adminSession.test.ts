import { describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

vi.mock('../../src/lib/server/admin/clients', () => ({
  adminConfig: () => { throw new Error('Missing configuration'); },
  serviceClient: vi.fn(), credentialClient: vi.fn()
}));

import { createAdminAuth } from '../../src/lib/server/admin/session';
import { decryptToken, encryptToken, hashToken } from '../../src/lib/server/admin/crypto';

const origin = 'https://reviewer.example';
const key = Buffer.alloc(32, 7).toString('base64');
const now = Date.parse('2026-10-21T00:00:00Z');
const adminId = '1ae03dba-2003-4f7e-b12c-828b648edb31';

function fixture() {
  const sessions = new Map<string, any>();
  const cookies = new Map<string, string>();
  const options = new Map<string, any>();
  let member = true;
  let passwordValid = true;
  let userValid = true;
  let outage = false;
  let configured = true;
  let clock = now;
  let authStatus = 401;
  let tokenExpiry = now / 1000 + 7200;
  let passwordCalls = 0;
  let userCalls = 0;
  const rpcCalls = new Map<string, number>();
  const failures = new Map<string, number>();
  const rpc = async (action: string, args: any) => {
    rpcCalls.set(action, (rpcCalls.get(action) ?? 0) + 1);
    if (outage) throw new Error('database unavailable');
    if (action === 'auth_member') return { active: member, email: 'admin@example.com' };
    if (action === 'auth_session_put') { sessions.set(args.id, { ...args }); return null; }
    if (action === 'auth_session_get') return [...sessions.values()].find(row => row.hash === args.hash) ?? null;
    if (action === 'auth_session_delete') { sessions.delete(args.id); return null; }
    if (action === 'auth_throttle') {
      if ((failures.get(args.key) ?? 0) >= 5) return { allowed: false };
      failures.set(args.key, (failures.get(args.key) ?? 0) + 1);
      return { allowed: true };
    }
    if (action === 'auth_audit') return null;
    throw new Error(`Unexpected action ${action}`);
  };
  const auth = createAdminAuth({
    config: () => { if (!configured) throw new Error('missing settings'); return { origin, encryptionKey: key }; },
    rpc,
    credentials: () => ({ auth: {
      signInWithPassword: async ({ password }: any) => { passwordCalls++; return passwordValid && password === 'correct-password'
        ? { data: { user: { id: adminId }, session: { access_token: 'supabase-secret-access', refresh_token: 'must-not-store', expires_at: tokenExpiry } }, error: null }
        : { data: { user: null, session: null }, error: { status: 400 } }; },
      getUser: async () => { userCalls++; return userValid
        ? { data: { user: { id: adminId } }, error: null }
        : { data: { user: null }, error: { status: authStatus } }; }
    } } as any),
    now: () => clock
  });
  function event(method = 'GET', body?: Record<string, string>, headers: Record<string, string> = {}) {
    const reqHeaders = new Headers({ origin, ...headers });
    if (body) reqHeaders.set('content-type', 'application/x-www-form-urlencoded');
    return {
      request: new Request(`${origin}/admin/login`, { method, headers: reqHeaders, body: body ? new URLSearchParams(body) : undefined }),
      url: new URL(`${origin}/admin/login`), locals: {}, getClientAddress: () => '192.0.2.1',
      cookies: { get: (name: string) => cookies.get(name), set: (name: string, value: string, opts: any) => { cookies.set(name, value); options.set(name, opts); }, delete: (name: string) => cookies.delete(name) }
    } as unknown as RequestEvent;
  }
  async function login() {
    const nonce = auth.issueLoginNonce(event());
    await auth.loginAdmin(event('POST', { csrf: nonce }), 'admin@example.com', 'correct-password');
  }
  const calls = () => ({ user: userCalls, session: rpcCalls.get('auth_session_get') ?? 0, member: rpcCalls.get('auth_member') ?? 0 });
  return { calls, auth, event, login, sessions, cookies, options, passwordCalls: () => passwordCalls, setMember: (value: boolean) => { member = value; }, setPassword: (value: boolean) => { passwordValid = value; }, setUser: (value: boolean) => { userValid = value; }, setOutage: (value: boolean) => { outage = value; }, setConfigured: (value: boolean) => { configured = value; }, setClock: (value: number) => { clock = value; }, setExpiry: (value: number) => { tokenExpiry = value; }, setAuthStatus: (value: number) => { userValid = false; authStatus = value; } };
}

describe('admin sessions', () => {
  it('replaces request-local session data after reauthentication rotates the CSRF token', async () => {
    const f = fixture(); await f.login();
    const old = f.cookies.get('cse_admin_csrf')!;
    const request = f.event('POST', { csrf: old });
    const ctx = await f.auth.reauthenticateAdmin(request, 'correct-password');
    expect(await f.auth.getCsrf(request)).toBe(f.cookies.get('cse_admin_csrf'));
    expect(f.cookies.get('cse_admin_csrf')).not.toBe(old);
    await expect(f.auth.requireAdminMutation(request, ctx)).rejects.toMatchObject({ status: 403 });
  });
  it('shares verified auth reads within one request, but checks a new request again', async () => {
    const f = fixture(); await f.login();
    const initial = f.calls();
    const request = f.event('POST', { csrf: f.cookies.get('cse_admin_csrf')! });
    const ctx = await f.auth.requireAdmin(request);
    await f.auth.requireAdminMutation(request, ctx);
    expect(await f.auth.requireAdmin(request)).toEqual(ctx);
    await f.auth.requireAdminMutation(request, ctx);
    expect(f.calls()).toEqual({ user: initial.user + 1, session: initial.session + 1, member: initial.member + 1 });
    f.setMember(false);
    await expect(f.auth.requireAdmin(f.event())).rejects.toMatchObject({ status: 403 });
  });
  it('admits at most five simultaneous password checks across separate preauth browsers', async () => {
    const f = fixture(); f.setPassword(false);
    const nonce = f.auth.issueLoginNonce(f.event());
    const requests = Array.from({ length: 20 }, () => {
      const event = f.event('POST', { csrf: nonce });
      const local = new Map(f.cookies);
      Object.assign(event, { cookies: { get: (name: string) => local.get(name), delete: (name: string) => local.delete(name) } });
      return f.auth.loginAdmin(event, 'admin@example.com', 'bad');
    });
    const results = await Promise.allSettled(requests);
    expect(f.passwordCalls()).toBe(5);
    expect(results.filter(r => r.status === 'rejected' && r.reason.status === 429)).toHaveLength(15);
  });
  it('encrypts access tokens with authenticated encryption and rejects tampering', () => {
    const encrypted = encryptToken('secret-access', key);
    expect(encrypted).not.toContain('secret-access');
    expect(decryptToken(encrypted, key)).toBe('secret-access');
    expect(() => decryptToken(encrypted.slice(0, -5) + 'aaaaa', key)).toThrow();
  });

  it('stores only hashed opaque tokens and encrypted credentials with a capped lifetime', async () => {
    const f = fixture(); await f.login();
    const row = [...f.sessions.values()][0];
    expect(row.hash).toBe(hashToken(f.cookies.get('cse_admin_session')!));
    expect(row.expiresAt).toBe('2026-10-21T01:00:00.000Z');
    expect(JSON.stringify(row)).not.toContain('supabase-secret-access');
    expect(JSON.stringify(row)).not.toContain('must-not-store');
    expect(f.options.get('cse_admin_session')).toMatchObject({ httpOnly: true, secure: true, sameSite: 'strict', path: '/admin' });
    expect(await f.auth.requireAdmin(f.event())).toMatchObject({ adminId });
  });

  it('does not authorize forged cookies, reviewer tokens, expired sessions, or revoked membership', async () => {
    const f = fixture();
    f.cookies.set('cse_admin_session', 'reviewer-google-token');
    await expect(f.auth.requireAdmin(f.event())).rejects.toMatchObject({ status: 401 });
    await f.login(); f.setMember(false);
    await expect(f.auth.requireAdmin(f.event())).rejects.toMatchObject({ status: 403 });
    f.setMember(true); [...f.sessions.values()][0].expiresAt = '2026-10-20T00:00:00Z';
    await expect(f.auth.requireAdmin(f.event())).rejects.toMatchObject({ status: 401 });
  });

  it('revalidates the Auth identity and fails closed on database outages', async () => {
    const f = fixture(); await f.login(); f.setUser(false);
    await expect(f.auth.requireAdmin(f.event())).rejects.toMatchObject({ status: 401 });
    f.setUser(true); f.setOutage(true);
    await expect(f.auth.requireAdmin(f.event())).rejects.toMatchObject({ status: 503 });
  });

  it('returns unavailable for missing server settings and network failures rather than serving cached identity', async () => {
    const f = fixture(); await f.login(); f.setAuthStatus(0);
    await expect(f.auth.requireAdmin(f.event())).rejects.toMatchObject({ status: 503 });
    f.setConfigured(false);
    await expect(f.auth.requireAdmin(f.event())).rejects.toMatchObject({ status: 503 });
  });

  it('uses the earlier credential expiry and rejects a retained nonce after five minutes', async () => {
    const f = fixture(); f.setExpiry(now / 1000 + 30); await f.login();
    expect([...f.sessions.values()][0].expiresAt).toBe('2026-10-21T00:00:30.000Z');
    const nonce = f.auth.issueLoginNonce(f.event()); f.setClock(now + 300_001);
    await expect(f.auth.loginAdmin(f.event('POST', { csrf: nonce }), 'admin@example.com', 'correct-password')).rejects.toMatchObject({ status: 403 });
  });

  it('keeps the regenerated login nonce consistent when a failed form action also reruns the page load', () => {
    const f = fixture();
    const actionNonce = f.auth.issueLoginNonce(f.event());
    const loadNonce = f.auth.issueLoginNonce(f.event());
    expect(loadNonce).toBe(actionNonce);
    expect(f.cookies.get('cse_admin_login')).toBe(actionNonce);
  });

  it('accepts the multipart form sent by progressive enhancement while retaining CSRF protection', async () => {
    const f = fixture();
    const nonce = f.auth.issueLoginNonce(f.event());
    const form = new FormData(); form.set('csrf', nonce);
    const event = f.event('POST');
    Object.assign(event, { request: new Request(`${origin}/admin/login`, { method: 'POST', headers: { origin }, body: form }) });
    await f.auth.loginAdmin(event, 'admin@example.com', 'correct-password');
    expect(await f.auth.requireAdmin(f.event())).toMatchObject({ adminId });
  });

  it('uses identical failure messages for wrong passwords and nonmembers and throttles after five failures', async () => {
    const f = fixture(); f.setPassword(false);
    let first: any;
    for (let i = 0; i < 5; i++) {
      const nonce = f.auth.issueLoginNonce(f.event());
      try { await f.auth.loginAdmin(f.event('POST', { csrf: nonce }), 'ADMIN@example.com', 'bad'); } catch (error) { first = error; }
    }
    const nonce = f.auth.issueLoginNonce(f.event());
    await expect(f.auth.loginAdmin(f.event('POST', { csrf: nonce }), 'admin@example.com', 'bad')).rejects.toMatchObject({ status: 429 });
    const nonmember = fixture(); nonmember.setMember(false);
    const n = nonmember.auth.issueLoginNonce(nonmember.event());
    await expect(nonmember.auth.loginAdmin(nonmember.event('POST', { csrf: n }), 'admin@example.com', 'correct-password')).rejects.toMatchObject({ body: first.body });
  });

  it('rejects absent or cross-origin preauth nonces and unsafe mutation requests', async () => {
    const f = fixture();
    await expect(f.auth.loginAdmin(f.event('POST', { csrf: 'forged' }), 'admin@example.com', 'correct-password')).rejects.toMatchObject({ status: 403 });
    await f.login();
    const ctx = await f.auth.requireAdmin(f.event());
    await expect(f.auth.requireAdminMutation(f.event('POST', { csrf: f.cookies.get('cse_admin_csrf')! }, { origin: 'https://evil.example' }), ctx)).rejects.toMatchObject({ status: 403 });
    await expect(f.auth.requireAdminMutation(f.event('POST', {}), ctx)).rejects.toMatchObject({ status: 403 });
    await expect(f.auth.requireAdminMutation(f.event('POST', undefined, { 'content-type': 'text/plain' }), ctx)).rejects.toMatchObject({ status: 415 });
    await expect(f.auth.requireAdminMutation(f.event('POST', { csrf: f.cookies.get('cse_admin_csrf')! }), ctx)).resolves.toBeUndefined();
  });

  it('reauthenticates the same admin, rotates secrets and logs out only the admin cookies', async () => {
    const f = fixture(); await f.login();
    f.cookies.set('reviewer', 'google-session');
    const old = f.cookies.get('cse_admin_session');
    const event = f.event('POST', { csrf: f.cookies.get('cse_admin_csrf')! });
    const ctx = await f.auth.reauthenticateAdmin(event, 'correct-password');
    expect(ctx.reauthenticatedAt).toBe('2026-10-21T00:00:00.000Z');
    expect(f.cookies.get('cse_admin_session')).not.toBe(old);
    await f.auth.logoutAdmin(f.event('POST', { csrf: f.cookies.get('cse_admin_csrf')! }));
    expect(f.sessions.size).toBe(0);
    expect(f.cookies.get('reviewer')).toBe('google-session');
  });
});
