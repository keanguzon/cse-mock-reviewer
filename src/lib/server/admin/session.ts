import { randomUUID } from 'node:crypto';
import { error, isHttpError, type RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminConfig, credentialClient, serviceClient } from './clients';
import { decryptToken, encryptToken, equalTokens, hashToken, randomToken, signNonce } from './crypto';
import { mutationToken, verifyCsrf } from './csrf';

export interface AdminContext { adminId: string; sessionId: string; reauthenticatedAt: string | null }
interface SessionRow {
  id: string; hash: string; adminId: string; accessTokenEncrypted: string;
  csrfHash: string; expiresAt: string; reauthenticatedAt: string | null;
}
interface Dependencies {
  config: () => { origin: string; encryptionKey: string };
  credentials: () => SupabaseClient;
  rpc: (action: string, args: Record<string, unknown>) => Promise<any>;
  now: () => number;
}

const SESSION = 'cse_admin_session';
const CSRF = 'cse_admin_csrf';
const NONCE = 'cse_admin_login';
const INVALID = 'Unable to sign in with these credentials.';
const UNAVAILABLE = 'Administrator sign-in is unavailable.';
const authUnavailable = (failure: { status?: number } | null) => failure !== null && (failure.status === undefined || failure.status === 0 || failure.status === 429 || failure.status >= 500);

export function createAdminAuth(deps: Dependencies) {
  function config() {
    try { return deps.config(); } catch { error(503, UNAVAILABLE); }
  }
  async function rpc(action: string, args: Record<string, unknown>) {
    try { return await deps.rpc(action, args); } catch { error(503, UNAVAILABLE); }
  }
  function cookieOptions(httpOnly: boolean, expires?: Date) {
    return { path: '/admin', httpOnly, secure: new URL(config().origin).protocol === 'https:', sameSite: 'strict' as const, ...(expires ? { expires } : {}) };
  }
  async function audit(adminId: string | null, action: string, status: 'succeeded' | 'failed') {
    try { await deps.rpc('auth_audit', { adminId, action, status }); } catch { /* Authentication never implies audit durability during an outage. */ }
  }
  async function member(userId: string): Promise<{ active: boolean; email?: string }> {
    const result = await rpc('auth_member', { userId });
    return result && typeof result.active === 'boolean' ? result : { active: false };
  }
  function clearCookies(event: RequestEvent) {
    for (const name of [SESSION, CSRF, NONCE]) event.cookies.delete(name, { path: '/admin' });
  }
  function issueLoginNonce(event: RequestEvent) {
    const c = config();
    const existing = event.cookies.get(NONCE);
    if (existing && validLoginNonce(existing)) return existing;
    const value = `${deps.now()}.${randomToken()}`;
    const nonce = `${value}.${signNonce(value, c.encryptionKey)}`;
    event.cookies.set(NONCE, nonce, { ...cookieOptions(true), maxAge: 300 });
    return nonce;
  }
  function validLoginNonce(nonce: string): boolean {
    if (nonce.length > 256) return false;
    const [timestamp, random, signature, extra] = nonce.split('.');
    const age = deps.now() - Number(timestamp);
    return Boolean(random && signature && !extra && Number.isFinite(age) && age >= 0 && age <= 300_000
      && equalTokens(signNonce(`${timestamp}.${random}`, config().encryptionKey), signature));
  }
  async function verifyLoginNonce(event: RequestEvent) {
    const c = config();
    const submitted = await mutationToken(event, c.origin);
    const cookie = event.cookies.get(NONCE) ?? '';
    if (!equalTokens(cookie, submitted) || !validLoginNonce(submitted)) error(403, 'Request rejected.');
    event.cookies.delete(NONCE, { path: '/admin' });
  }
  function throttleKeys(event: RequestEvent, email: string) {
    let address: string;
    try { address = event.getClientAddress(); } catch { error(503, UNAVAILABLE); }
    return [`email:${hashToken(email.trim().toLowerCase())}`, `ip:${hashToken(address)}`];
  }
  async function throttle(keys: string[]) {
    for (const key of keys) {
      const result = await rpc('auth_throttle', { key, failed: false });
      if (result?.allowed !== true) error(429, 'Unable to sign in. Try again later.');
    }
  }
  async function passwordAuth(email: string, password: string) {
    try {
      const result = await deps.credentials().auth.signInWithPassword({ email, password });
      if (authUnavailable(result.error)) error(503, UNAVAILABLE);
      return result;
    } catch (cause) {
      if (isHttpError(cause)) throw cause;
      error(503, UNAVAILABLE);
    }
  }
  async function writeSession(event: RequestEvent, session: { access_token: string; expires_at?: number }, adminId: string, id: string, reauthenticatedAt: string | null) {
    if (!session.expires_at || session.expires_at * 1000 <= deps.now()) error(503, UNAVAILABLE);
    const token = randomToken(); const csrf = randomToken();
    const expires = new Date(Math.min(session.expires_at * 1000, deps.now() + 3_600_000));
    const row: SessionRow = { id, hash: hashToken(token), adminId, accessTokenEncrypted: encryptToken(session.access_token, config().encryptionKey), csrfHash: hashToken(csrf), expiresAt: expires.toISOString(), reauthenticatedAt };
    await rpc('auth_session_put', { ...row });
    event.cookies.set(SESSION, token, cookieOptions(true, expires));
    event.cookies.set(CSRF, csrf, cookieOptions(false, expires));
    const ctx: AdminContext = { adminId, sessionId: id, reauthenticatedAt };
    event.locals.admin = ctx;
    return ctx;
  }
  async function loginAdmin(event: RequestEvent, rawEmail: string, password: string) {
    await verifyLoginNonce(event);
    const email = rawEmail.trim().toLowerCase();
    const keys = throttleKeys(event, email);
    await throttle(keys);
    if (!email || email.length > 254 || !password || password.length > 1024) {
      await audit(null, 'login_failure', 'failed'); error(400, INVALID);
    }
    let result;
    try { result = await passwordAuth(email, password); }
    catch (cause) { await audit(null, 'login_failure', 'failed'); throw cause; }
    const user = result.data.user; const session = result.data.session;
    if (result.error || !user || !session || !(await member(user.id)).active) {
      await audit(null, 'login_failure', 'failed'); error(400, INVALID);
    }
    const previous = event.cookies.get(SESSION);
    if (previous) {
      const row = await rpc('auth_session_get', { hash: hashToken(previous) });
      if (row?.id) await rpc('auth_session_delete', { id: row.id });
    }
    await writeSession(event, session, user.id, randomUUID(), null);
    await audit(user.id, 'login_success', 'succeeded');
  }
  async function sessionRow(event: RequestEvent): Promise<SessionRow> {
    config();
    const token = event.cookies.get(SESSION);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) error(401, 'Administrator sign-in required.');
    const row: SessionRow | null = await rpc('auth_session_get', { hash: hashToken(token) });
    if (!row || !Number.isFinite(Date.parse(row.expiresAt)) || Date.parse(row.expiresAt) <= deps.now()) {
      clearCookies(event); error(401, 'Administrator sign-in required.');
    }
    return row;
  }
  async function requireAdmin(event: RequestEvent): Promise<AdminContext> {
    const row = await sessionRow(event);
    let access: string;
    try { access = decryptToken(row.accessTokenEncrypted, config().encryptionKey); } catch { error(503, UNAVAILABLE); }
    let result;
    try { result = await deps.credentials().auth.getUser(access); } catch { error(503, UNAVAILABLE); }
    if (authUnavailable(result.error)) error(503, UNAVAILABLE);
    if (result.error || !result.data.user || result.data.user.id !== row.adminId) error(401, 'Administrator sign-in required.');
    if (!(await member(row.adminId)).active) error(403, 'Administrator access denied.');
    return { adminId: row.adminId, sessionId: row.id, reauthenticatedAt: row.reauthenticatedAt };
  }
  async function requireAdminMutation(event: RequestEvent, ctx: AdminContext) {
    const token = await mutationToken(event, config().origin);
    const row = await sessionRow(event);
    if (row.id !== ctx.sessionId || row.adminId !== ctx.adminId) error(403, 'Request rejected.');
    verifyCsrf(token, row.csrfHash);
  }
  async function getCsrf(event: RequestEvent) {
    const row = await sessionRow(event);
    const token = event.cookies.get(CSRF) ?? '';
    verifyCsrf(token, row.csrfHash);
    return token;
  }
  async function logoutAdmin(event: RequestEvent) {
    const ctx = await requireAdmin(event);
    await requireAdminMutation(event, ctx);
    await rpc('auth_session_delete', { id: ctx.sessionId });
    clearCookies(event);
    await audit(ctx.adminId, 'logout', 'succeeded');
  }
  async function reauthenticateAdmin(event: RequestEvent, password: string) {
    const ctx = await requireAdmin(event);
    await requireAdminMutation(event, ctx);
    const current = await member(ctx.adminId);
    if (!current.active || !current.email) error(403, 'Administrator access denied.');
    const keys = throttleKeys(event, current.email);
    await throttle(keys);
    if (!password || password.length > 1024) {
      await audit(ctx.adminId, 'reauth_failure', 'failed'); error(400, INVALID);
    }
    let result;
    try { result = await passwordAuth(current.email, password); }
    catch (cause) { await audit(ctx.adminId, 'reauth_failure', 'failed'); throw cause; }
    if (result.error || result.data.user?.id !== ctx.adminId || !result.data.session) {
      await audit(ctx.adminId, 'reauth_failure', 'failed'); error(400, INVALID);
    }
    const updated = await writeSession(event, result.data.session, ctx.adminId, ctx.sessionId, new Date(deps.now()).toISOString());
    await audit(ctx.adminId, 'reauth_success', 'succeeded');
    return updated;
  }
  return { issueLoginNonce, loginAdmin, requireAdmin, requireAdminMutation, getCsrf, logoutAdmin, reauthenticateAdmin };
}

const auth = createAdminAuth({
  config: adminConfig, credentials: credentialClient, now: Date.now,
  rpc: async (action, args) => {
    const { data, error: rpcError } = await serviceClient().rpc('admin_console', { p_action: action, p_args: args });
    if (rpcError) throw new Error('Admin database request failed');
    return data;
  }
});
export const { issueLoginNonce, loginAdmin, requireAdmin, requireAdminMutation, getCsrf, logoutAdmin, reauthenticateAdmin } = auth;
