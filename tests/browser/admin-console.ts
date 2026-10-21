import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createDatabaseHarness, seedHarness, ids, fixtureAttempt } from '../integration/databaseHarness.ts';

// Auth HTTP is a local fixture. Database RPCs execute the actual migrations in PGlite.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const origin = 'http://127.0.0.1:5174';
const h = await createDatabaseHarness();
console.log('Fixture database migrated.');
await seedHarness(h);
for (let i = 1; i <= 25; i++) {
  const attempt = fixtureAttempt(`10000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
  await h.asRole('authenticated', ids.a, () => h.db.query('SELECT public.save_attempt($1::jsonb)', [JSON.stringify(attempt)]));
}
await h.asRole('authenticated', ids.b, () => h.db.query('SELECT public.save_attempt($1::jsonb)', [JSON.stringify(fixtureAttempt('20000000-0000-4000-8000-000000000001', ids.b))]));
const beforeB = JSON.stringify((await h.db.query('SELECT * FROM public.exam_attempts WHERE user_id=$1', [ids.b])).rows);
const exp = Math.floor(Date.now() / 1000) + 3600;
const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: ids.admin, exp, role: 'authenticated' })).toString('base64url')}.fixture`;
const admin = { id: ids.admin, email: 'admin@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
let failDeletion = true;
let queue = Promise.resolve();
const backend = createServer((req, res) => {
  queue = queue.then(async () => {
    let text = ''; for await (const chunk of req) text += chunk;
    const body = text ? JSON.parse(text) : {};
    const send = (status: number, data: unknown) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
    if (req.url?.startsWith('/auth/v1/token')) {
      if (body.email !== admin.email || body.password !== 'fixture-password') return send(400, { code: 'invalid_credentials', msg: 'Invalid credentials' });
      return send(200, { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'fixture-refresh', user: admin });
    }
    if (req.url === '/auth/v1/user') return send(200, admin);
    if (req.url?.startsWith('/auth/v1/admin/users/')) {
      const userId = req.url.split('/').at(-1);
      if (req.method === 'DELETE') {
        if (failDeletion) { failDeletion = false; return send(500, { msg: 'fixture dependency failure' }); }
        await h.db.query('DELETE FROM auth.users WHERE id=$1', [userId]); return send(200, {});
      }
      const row = (await h.db.query('SELECT id,email FROM auth.users WHERE id=$1', [userId])).rows[0];
      return send(row ? 200 : 404, row ? { user: row } : { code: 'user_not_found', msg: 'Not found' });
    }
    if (req.url === '/rest/v1/rpc/admin_console') {
      try {
        const result = await h.asRole('service_role', null, () => h.db.query<{ value: unknown }>('SELECT public.admin_console($1,$2::jsonb) AS value', [body.p_action, JSON.stringify(body.p_args)]));
        return send(200, result.rows[0].value);
      } catch (e) { console.log('Fixture RPC rejected:', body.p_action, (e as Error).message); return send(400, { message: (e as Error).message, code: 'P0001' }); }
    }
    send(404, { message: 'Fixture endpoint not found' });
  }).catch(e => { console.error(e); res.writeHead(500); res.end(); });
});
await new Promise<void>(resolve => backend.listen(0, '127.0.0.1', resolve));
console.log('Fixture Auth HTTP ready.');
const address = backend.address() as { port: number };
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'dev', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], {
  cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PUBLIC_SUPABASE_URL: `http://127.0.0.1:${address.port}`, PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-canary', ADMIN_SESSION_ENCRYPTION_KEY: randomBytes(32).toString('base64'), ADMIN_ALLOWED_ORIGIN: origin }
});
let viteLog = ''; vite.stdout.on('data', value => viteLog += value); vite.stderr.on('data', value => viteLog += value);
let browser: any;
let activePage: any;
const artifacts = '.superpowers/sdd/2026-10-21-admin-console/browser';
await mkdir(artifacts, { recursive: true });
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${origin}/admin/login`, { signal: AbortSignal.timeout(2000) })).ok) break; } catch { /* Wait for the local fixture server. */ }
    if (i === 99) throw Error(`Vite did not start: ${viteLog}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) });
  console.log('Vite and browser ready.');
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', (route: any) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const page = await context.newPage();
  activePage = page;
  page.on('response', async (response: any) => {
    if (response.url().includes('/admin/') && response.status() >= 400) console.log('Fixture request failure:', response.status(), new URL(response.url()).pathname, await response.text());
  });
  const errors: string[] = []; page.on('pageerror', (e: Error) => errors.push(e.message));
  const unauth = await context.request.get(`${origin}/admin/api/users`); assert.equal(unauth.status(), 401);
  await page.goto(`${origin}/admin/users`); await page.waitForURL('**/admin/login');
  await page.waitForLoadState('networkidle');
  assert.equal(await page.getByRole('button', { name: 'Sign in', exact: true }).evaluate((el: HTMLElement) => getComputedStyle(el).fontFamily), await page.locator('body').evaluate((el: HTMLElement) => getComputedStyle(el).fontFamily));
  await page.screenshot({ path: `${artifacts}/admin-login-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${artifacts}/admin-login-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Email', { exact: true }).fill(admin.email);
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('alert').waitFor();
  await page.getByLabel('Email', { exact: true }).fill(admin.email);
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.waitForURL(`${origin}/admin`);
  console.log('Browser login passed.');
  await page.locator('.admin-loading').waitFor({ state: 'hidden' });
  let userReads = 0;
  let releaseUsers!: () => void;
  const usersGate = new Promise<void>(resolve => { releaseUsers = resolve; });
  await page.route('**/admin/api/users?**', async (route: any) => { userReads++; if (userReads === 1) await usersGate; await route.continue(); });
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await page.getByRole('status', { name: 'Loading administration', exact: true }).waitFor();
  await page.screenshot({ path: `${artifacts}/admin-loading.png` });
  releaseUsers();
  await page.getByText('a@example.test', { exact: true }).waitFor();
  await page.locator('.admin-loading').waitFor({ state: 'hidden' });
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await page.locator('.admin-loading').waitFor({ state: 'hidden' });
  let navigationReads = 0;
  const countNavigation = (request: any) => { const path = new URL(request.url()).pathname; if (path.startsWith('/admin/') && path.endsWith('/__data.json')) navigationReads++; };
  page.on('request', countNavigation);
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await page.getByText('a@example.test', { exact: true }).waitFor();
  page.off('request', countNavigation);
  assert.equal(navigationReads, 0, 'Warm child-page navigation must not wait for a server layout request');
  assert.equal(userReads, 1, 'Warm users page should use the same-session memory cache');
  assert.equal(await page.locator('.admin-loading').count(), 0);
  let releaseRefresh!: () => void;
  const refreshGate = new Promise<void>(resolve => { releaseRefresh = resolve; });
  let refreshStarted!: () => void;
  const refreshRequest = new Promise<void>(resolve => { refreshStarted = resolve; });
  await page.route('**/admin/api/users?**', async (route: any) => {
    userReads++;
    refreshStarted();
    await refreshGate;
    const response = await route.fetch();
    const value = await response.json();
    value.items.find((user: any) => user.id === ids.a).displayName = 'Background refresh fixture';
    await route.fulfill({ response, json: value });
  }, { times: 1 });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await Promise.race([refreshRequest, new Promise((_, reject) => setTimeout(() => reject(new Error('Background refresh did not start')), 10_000))]);
  assert.equal(await page.locator('.admin-loading').count(), 0, 'Background revalidation must not block cached content');
  await page.getByText('a@example.test', { exact: true }).waitFor();
  releaseRefresh();
  await page.getByRole('row').filter({ hasText: 'Background refresh fixture' }).waitFor();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.locator('.admin-loading').waitFor({ state: 'hidden' });
  assert.equal(userReads, 3, 'Explicit Refresh must bypass the cache');
  await page.goto(`${origin}/admin/users/${ids.a}`);
  await page.getByText('0 selected · 25 matching exams', { exact: true }).waitFor();
  await page.getByRole('checkbox', { name: 'Select page', exact: true }).check();
  await page.getByRole('button', { name: 'Select all 25 matching exams', exact: true }).click();
  await page.getByText('25 selected · 25 matching exams', { exact: true }).waitFor();
  await page.getByRole('checkbox', { name: 'Select', exact: true }).first().uncheck();
  await page.getByText('24 selected · 25 matching exams', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
  await page.getByRole('dialog').getByText(/exactly 24 selected exams/).waitFor();
  assert.equal(await page.getByRole('dialog').evaluate((el: HTMLElement) => getComputedStyle(el).backgroundColor), 'rgb(23, 25, 35)');
  await page.screenshot({ path: `${artifacts}/admin-confirm-desktop.png`, fullPage: true });
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Admin page overflow at ${width}`);
    assert.ok(await page.getByRole('dialog').evaluate((el: HTMLElement) => el.scrollWidth <= el.clientWidth), `Admin dialog overflow at ${width}`);
  }
  await page.screenshot({ path: `${artifacts}/admin-confirm-mobile.png`, fullPage: true });
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    assert.ok(await page.getByRole('dialog').evaluate((el: HTMLElement) => el.matches(':modal') && (el.contains(document.activeElement) || document.activeElement === document.body)), 'Focus reached the inert background');
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.keyboard.press('Escape'); assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Delete selected', exact: true }).evaluate((el: HTMLElement) => el === document.activeElement), true);
  await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
  await page.getByLabel('From (UTC)', { exact: true }).fill('2030-01-01');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await page.getByText('0 selected · 0 matching exams', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByText('0 selected · 25 matching exams', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm deletion', exact: true }).click();
  await page.getByText('0 selected · 24 matching exams', { exact: true }).waitFor();
  await page.getByRole('checkbox', { name: 'Select page', exact: true }).check();
  await page.getByRole('button', { name: 'Select all 24 matching exams', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Select', exact: true }).first().uncheck();
  await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
  await page.getByRole('dialog').getByText(/exactly 23 selected exams/).waitFor();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm deletion', exact: true }).click();
  await page.getByText('0 selected · 1 matching exams', { exact: true }).waitFor();
  console.log('Single and all-matching deletion passed.');
  await page.getByRole('button', { name: 'Reset progress', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm deletion', exact: true }).click();
  await page.getByText('0 selected · 0 matching exams', { exact: true }).waitFor();
  assert.equal(Number((await h.db.query<{ generation: number }>('SELECT generation FROM private.user_data_state WHERE user_id=$1', [ids.a])).rows[0].generation), 1);
  await page.screenshot({ path: `${artifacts}/admin-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${artifacts}/admin-mobile.png`, fullPage: true });
  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to final confirmation', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Permanently delete account', exact: true }).isDisabled(), true);
  await page.getByLabel("Type the user's email", { exact: true }).fill('a@example.test');
  await page.getByLabel('Your administrator password', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Permanently delete account', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'auth_delete_failed' }).waitFor();
  await page.getByRole('link', { name: 'Audit', exact: true }).click();
  await page.getByRole('button', { name: 'Retry account deletion', exact: true }).first().click();
  await page.getByLabel('Your administrator password', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Reauthenticate and retry', exact: true }).click();
  await page.getByText('0 · complete', { exact: true }).first().waitFor();
  assert.equal((await h.db.query('SELECT id FROM auth.users WHERE id=$1', [ids.a])).rows.length, 0);
  assert.equal(JSON.stringify((await h.db.query('SELECT * FROM public.exam_attempts WHERE user_id=$1', [ids.b])).rows), beforeB);
  await page.goto(`${origin}/admin/users/${ids.admin}`);
  await page.getByText('Administrator accounts are protected from these actions.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Delete account', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Log out', exact: true }).click(); await page.waitForURL('**/admin/login');
  await page.evaluate(() => { localStorage.setItem('cse_is_guest', 'true'); localStorage.setItem('cse_onboarding_seen', 'true'); });
  await page.goto(origin); await page.locator('select').first().waitFor();
  const options = await page.locator('select').allTextContents();
  assert.ok(options.some((value: string) => /150/.test(value) && /170/.test(value)));
  assert.ok(options.some((value: string) => /Mixed Categories/.test(value)));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${artifacts}/reviewer-mobile.png`, fullPage: true });
  await page.goto(`${origin}/quiz?mode=practice&level=professional&limit=1`);
  await page.locator('.choice-btn').first().click();
  await page.getByRole('button', { name: 'CONFIRM ANSWER', exact: true }).click();
  await page.getByRole('button', { name: 'SUBMIT', exact: true }).click();
  await page.getByRole('button', { name: 'SUBMIT NOW', exact: true }).click();
  await page.getByText('Progress saved on this device.', { exact: true }).waitFor();
  const completion = await page.evaluate(() => JSON.parse(localStorage.getItem('cse_guest_active_session:v2') || 'null'));
  assert.ok(completion?.completedAt && completion?.sessionId);
  await page.reload();
  await page.getByText('Progress saved on this device.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cse_guest_active_session:v2') || 'null')?.sessionId), completion.sessionId);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cse_guest_attempts') || '[]').length), 1);
  assert.deepEqual(errors, []);
  console.log('PASS: isolated browser admin login, selection, single/bulk delete, reset, Auth failure/retry, protected admin, other-user isolation, logout, mobile overflow, mixed/150/170 options, guest completion and idempotent reload.');
} catch (e) {
  if (activePage) {
    console.log('Browser failure page:', await activePage.locator('body').innerText());
    await activePage.screenshot({ path: `${artifacts}/failure.png`, fullPage: true });
  }
  console.log('Vite diagnostics:', viteLog.slice(-3000));
  throw e;
} finally {
  await browser?.close(); vite.kill(); backend.closeAllConnections(); await new Promise<void>(resolve => backend.close(() => resolve())); await h.close();
}
