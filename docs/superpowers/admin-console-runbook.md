# Admin console operator runbook

The implementation adds a separate administrator email/password session under `/admin`, reviewer write RPCs, deletion tombstones, generation/revision fences, and a recoverable Auth account deletion flow. This document describes preparation and operator steps; it does not authorize a production migration, account provisioning, or deployment. Implementation/commit/push approval does not authorize those operations.

## Runtime and secrets

Local implementation evidence (2026-10-21): `npm test` passed 169 bank tests and 64 unit tests; `npm run test:integration` passed 31 tests across seven PGlite suites; `npm run check` reported 0 errors and 68 existing reviewer warnings; the production build succeeded with adapter-auto's unspecified-host notice. The client bundle contained no private credential variable names or synthetic service-secret canary. The database and reviewer code are checkpointed through `d3228c9` on `CSE-reviewer-v1.5`.

The browser fixture in `tests/browser/admin-console.ts` ran actual SvelteKit routes and actual migration RPCs in disposable PGlite, with a synthetic local Auth HTTP service. It passed invalid/valid admin login, unauthenticated API rejection, page/all-matching selection and exclusion, escaped confirmation, single/bulk deletion, reset generation, typed-email double confirmation and password reauthentication, Auth deletion failure/retry, protected admin controls, unaffected user B, logout, mobile overflow checks at 390px, desktop screenshots at 1440px, Mixed Categories with 150/170 options, and guest completion/reload without duplicate results. No browser page errors were recorded. These are browser viewport checks, not physical-device checks or real Google/Supabase Auth verification.

To repeat that fixture with Node 24 and an existing Playwright installation, set `PLAYWRIGHT_MODULE_PATH` to its package directory and, if needed, `PLAYWRIGHT_EXECUTABLE` to an installed Chromium executable, then run `node --experimental-strip-types tests/browser/admin-console.ts` from the repository root. It creates only synthetic users in an in-memory database, starts local servers on loopback (app port 5174), and writes screenshots under the ignored `.superpowers/sdd/2026-10-21-admin-console/browser` directory. Do not point it at a production backend.

UI scope checks: PASS for inherited reviewer styling (no reviewer CSS/button geometry changes); PASS for contained admin table overflow at 390px and inspected desktop/mobile screenshots; PASS for functional destructive controls and visible success/error/empty states in the browser fixture; PASS for server-only credential separation in the production client-bundle scan. Dialogs use native modal focus containment and Escape handling with explicit focus restoration. Broader keyboard-only navigation, every filter combination, authenticated multi-tab/offline browser scenarios, and physical devices remain in the release checks below.

Use a deployment target that runs SvelteKit server hooks, actions, and endpoints with Node-compatible `node:crypto` and private runtime environment variables. The project currently uses `@sveltejs/adapter-auto`; verify that the selected host is supported before release. A static-only host cannot run this console. Keep SvelteKit's origin checking enabled and configure the host's trusted proxy/origin settings so the request URL has the actual public origin and `getClientAddress()` returns a trusted client address. Do not copy arbitrary forwarded headers into application authorization decisions.

Configure the following on the server. The public Supabase URL and anon key must refer to the same project as the service key.

| Variable | Required value |
| --- | --- |
| `PUBLIC_SUPABASE_URL` | Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Existing anon/public client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project service-role secret, server only |
| `ADMIN_SESSION_ENCRYPTION_KEY` | Exactly 32 cryptographically random bytes, standard padded base64 |
| `ADMIN_ALLOWED_ORIGIN` | Exact public origin, for example `https://reviewer.example.com`, without a path or trailing slash |

HTTPS is required for nonlocal origins. Only `http://localhost`, `http://127.0.0.1`, and `http://[::1]` origins are accepted for local work, with an explicit port when needed. Store private values in the host's secret manager; never put them in a `PUBLIC_` variable, committed file, screenshot, URL, browser console, or shared shell transcript. The application fails closed with 503 when required admin settings are missing or invalid.

For a new encryption key, use the secret manager's generator or generate 32 bytes using Node's `randomBytes(32).toString('base64')` in a private operator session. Transfer the result directly to secret storage. Changing this key makes old encrypted admin sessions unreadable; plan to revoke all admin sessions in the same approved maintenance step and require administrators to sign in again. Never restore a removed encryption key merely to revive old sessions.

Admin cookies have path `/admin`, SameSite Strict, no Domain, and Secure under HTTPS. `cse_admin_session` and the short-lived login nonce are HttpOnly. `cse_admin_csrf` is a readable random token whose hash is checked against the private session record; it is not a Supabase credential. A session ends at the earlier of the access token expiry and one hour after login. There is no refresh-token persistence or silent renewal. Logout clears only admin cookies and its server session, leaving Google reviewer sessions alone.

## Inspect an existing database before choosing a migration path

Use an operator database connection with read-only intent first. Capture the results privately together with the release and backup reference. The queries below do not mutate data.

```sql
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;

SELECT table_schema, table_name, column_name, data_type, is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema IN ('public', 'private')
  AND table_name IN ('questions','profiles','exam_attempts','user_progress',
                    'active_sessions','user_data_state','admin_memberships',
                    'admin_sessions','attempt_tombstones')
ORDER BY table_schema, table_name, ordinal_position;

SELECT n.nspname AS schema_name, c.relname AS table_name,
       con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public','private')
  AND c.relname IN ('profiles','exam_attempts','user_progress','active_sessions',
                   'user_data_state','attempt_tombstones')
ORDER BY n.nspname,c.relname,con.conname;

SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies
WHERE schemaname IN ('public','private')
ORDER BY schemaname,tablename,policyname;

SELECT grantee,table_schema,table_name,privilege_type
FROM information_schema.table_privileges
WHERE table_schema IN ('public','private')
  AND grantee IN ('PUBLIC','anon','authenticated','service_role')
ORDER BY table_schema,table_name,grantee,privilege_type;

SELECT grantee,table_schema,table_name,column_name,privilege_type
FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name='profiles'
  AND grantee IN ('anon','authenticated')
ORDER BY grantee,column_name,privilege_type;

SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef,p.proconfig,p.proacl,pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='private'
   OR (n.nspname='public' AND p.proname IN
       ('handle_new_user','get_random_questions','reviewer_data_state',
        'save_attempt','save_active_session','delete_active_session','admin_console'))
ORDER BY n.nspname,p.proname;

SELECT tgname,pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal;

SELECT nspname,nspacl FROM pg_namespace WHERE nspname='private';

SELECT 'profiles' AS table_name,count(*) FROM public.profiles
UNION ALL SELECT 'exam_attempts',count(*) FROM public.exam_attempts
UNION ALL SELECT 'user_progress',count(*) FROM public.user_progress
UNION ALL SELECT 'active_sessions',count(*) FROM public.active_sessions;
```

If the migration-history schema/table or any personal table is absent, record that result and inspect the relevant existing objects individually. Do not interpret an absent migration-history table as an empty application database. Also inspect the Supabase API schema configuration: `private` must not be an exposed PostgREST schema. That setting is external to the SQL fixture.

The migration order is:

1. `20260730_reviewer_baseline.sql`: preserves existing tables and question data; supplies a fresh database baseline and snapshot/level columns.
2. `20260731_create_user_progress.sql`: the existing historical migration, retained unchanged. Its policy creation is not safe to rerun blindly on a manually initialized database.
3. `20261021_admin_console.sql`: introduces private storage and fences, backfills existing attempts/sessions to generation zero, replaces personal-table policies and direct browser write grants, and installs the reviewer/admin RPCs. This is a one-time migration, not an idempotent bootstrap script.

For a fresh disposable local Supabase project, replay these migrations in that order using the project's installed Supabase migration tooling. A reset command destroys its selected database; use it only against a confirmed disposable local project, never the production link. Rehearse both a fresh replay and an upgrade of a restored pre-migration schema/data snapshot.

For an existing manually initialized installation, compare the inspected schema, defaults, constraints, functions, policies, and data prerequisites with both historical files. If the historical versions are already represented, repair only their migration-history records as applied. With an operator-reviewed Supabase CLI and the verified project link, the explicit history-only commands are:

```text
supabase migration repair 20260730 --status applied
supabase migration repair 20260731 --status applied
supabase migration list
supabase db push --dry-run
```

Do not run those commands until the schema comparison is complete; history repair does not create missing columns or fix policies. If prerequisites differ, first prepare and approve a minimal reconciliation migration for that actual schema, rehearse it on the snapshot, verify equivalence, then repair history. Do not mark `20261021` applied unless its effects have actually been installed and verified. The dry-run must list only the intended unapplied upgrade before an approved application. Do not use `--include-all` to force historical bootstrap files across an unexplained drift.

## Provision the separate administrator after deployment approval

Use the Supabase operator dashboard or a controlled server-only provisioning tool to create a new, confirmed email/password Auth identity with a strong password. Do not create it through the reviewer signup path, link it to an existing Google identity, or reuse a reviewer UUID. Record its UUID from that controlled provisioning step; a profile row created by the trusted signup trigger is expected. No administrator signup/invite/recovery/role-editor screen exists in this release.

After the admin migration and signup trigger are installed, inspect this newly created identity using a parameterized operator query. The following example uses psql's prompted variable so the password never appears in SQL:

```sql
\prompt 'New confirmed admin UUID: ' admin_user_id
SELECT u.id,u.email,u.email_confirmed_at,s.status,
       ARRAY(SELECT i.provider FROM auth.identities i WHERE i.user_id=u.id)
         AS providers,
       (SELECT count(*) FROM public.exam_attempts a WHERE a.user_id=u.id)
         AS exam_count,
       (SELECT count(*) FROM public.active_sessions a WHERE a.user_id=u.id)
         AS paused_count
FROM auth.users u
JOIN private.user_data_state s ON s.user_id=u.id
WHERE u.id=:'admin_user_id'::uuid;
```

Confirm this UUID is the newly provisioned identity, email is confirmed, lifecycle is active, provider is email only, and exam/paused counts are zero. Then, as an approved database operator, insert the membership:

```sql
BEGIN;
INSERT INTO private.admin_memberships(user_id,active)
SELECT u.id,true
FROM auth.users u
JOIN private.user_data_state s ON s.user_id=u.id
WHERE u.id=:'admin_user_id'::uuid
  AND u.email_confirmed_at IS NOT NULL AND s.status='active'
  AND EXISTS (SELECT 1 FROM auth.identities i
              WHERE i.user_id=u.id AND i.provider='email')
  AND NOT EXISTS (SELECT 1 FROM auth.identities i
                  WHERE i.user_id=u.id AND i.provider<>'email')
  AND NOT EXISTS (SELECT 1 FROM public.exam_attempts a WHERE a.user_id=u.id)
  AND NOT EXISTS (SELECT 1 FROM public.active_sessions a WHERE a.user_id=u.id)
RETURNING user_id,active;
-- Require exactly the expected new UUID above before committing.
COMMIT;
```

Do not commit if the returned identity/count is unexpected; roll back and investigate. Membership is private database state, not editable Auth user metadata. Admin sessions check current Auth identity and active membership on every protected request; destructive RPCs recheck membership, the session, and protected targets. The console prevents removing the current admin or another active admin.

To revoke an administrator in a separately approved operator step, set that UUID's private membership inactive and delete its private session rows in one transaction. Never expose this operation as a public reviewer RPC.

## Coordinated release and verification

Back up the database and verify restore into an isolated project before application. Record a release cutover window, expected old-client failure behavior, operator recovery contacts, and a rollback procedure that preserves lifecycle state, generation values, operation records, and tombstones.

The database migration deliberately revokes old direct reviewer writes to attempts, progress, and paused sessions. Deploy the reviewer RPC integration and database fences as one coordinated release; an old client must fail its old writes rather than bypass the fences. Keep admin destructive access unavailable until the migration, reviewer integration, server secrets, and smoke checks have all passed. Do not weaken grants temporarily to make an old client appear compatible. Stale/offline clients must reconnect to learn authoritative deletion/reset state; remote offline displays are not erased by the console.

Run local checks against the final release candidate:

```text
npm test
npm run test:integration
npm run check
npm run build
```

Record exact outcomes, baseline diagnostics, and the commit tested. Scan `.svelte-kit/output/client` for private variable names and nonsecret canaries substituted for server credentials during a build. Never put production secret values in search arguments or report output. Importing `$lib/server/admin` into browser code must fail SvelteKit's server-only boundary.

Use a disposable real Supabase project with two reviewer users A/B and one separate administrator to verify the following before production release:

- Fresh migration replay and upgrade rehearsal preserve existing rows; inspect grants/policies afterward. `private` is not API exposed; anon/authenticated cannot invoke `admin_console` or access its tables. Direct legacy PostgREST INSERT/UPDATE/DELETE fails. Owner reads and the new owner-only RPCs work; A cannot access or modify B.
- Separate Google reviewer and admin logins work concurrently. Admin login/logout leaves reviewer browser credentials intact. Reviewer bearer tokens and forged admin cookies do not authorize `/admin`; membership revocation takes effect on the next request. Auth/database outages return 503 and serve no cached private data.
- Login nonce, exact Origin, supported form/JSON content types, session CSRF, five admitted password checks per 15 minutes per normalized-email hash or trusted-client-address hash, cookie flags, one-hour/access-token expiry, response no-store/frame/referrer headers, and password reauthentication/secret rotation behave correctly through the actual host/proxy. Admission is reserved atomically before password verification, including successful checks.
- At desktop and 390px browser viewports, use the keyboard through login, page-only selection, explicit all-matching selection, pagination/filter/Refresh clearing, dialogs/cancel/focus return, deletion confirmation, reset and typed-email account deletion. Verify exact counts and all surviving-attempt analytics; B remains unchanged. Browser viewport checks are not physical-device tests.
- A queued/offline tombstoned attempt cannot return after deletion. Reset invalidates an in-flight/paused exam; generation/revision refresh on focus/reconnect and visible polling update two tabs. Same-ID retry stays idempotent, account switches cannot overwrite B, and old attempts missing generation are never relabeled to a post-reset generation.
- A saved account-deletion operation removes/fences app data before Auth deletion. Simulate Auth failure/uncertain transport and a failure after Auth success; explicit retry of the same operation reconciles safely. Concurrent retries honor the execution lease. Test stale but cryptographically valid deleted-user JWTs against real PostgREST reads and writes.
- Test a disposable account with an owned Storage object. If Auth deletion is blocked by that dependency, report the durable failed/pending operation and resolve Storage ownership through a separately approved operator action. The console does not remove unrelated Storage objects.

PGlite fixtures cover SQL transactions, modeled roles/RLS, concurrency guards, tombstones and lifecycle semantics. Unit tests use injected Auth responses. Neither proves GoTrue, PostgREST, Storage, Supabase project settings, trusted proxy configuration, or the selected hosting adapter. No real Supabase/production verification is implied by passing those local tests; keep the disposable-project checks as a deployment gate until their results are recorded.

## Deletion recovery and rollback

Account removal is a durable two-system operation: `prepared` → `app_data_removed` → `auth_delete_pending` → `complete`; Auth failures retain `auth_delete_failed` or pending state. App access stays fenced while Auth work is unresolved. The server's 30-second execution lease is bound to the actor/session and lease token. Use the console's explicit Retry with current membership and password reauthentication within five minutes; reuse the saved operation UUID. Do not submit a new deletion to conceal a partial outcome, restore removed app rows, or manually reduce a generation.

An account-delete response is complete only after the DB finalization checks Auth absence. If Auth succeeded but finalization failed, retry reconciles absence and finishes. Unknown transport outcomes remain pending/failed for reconciliation. Inspect sanitized operation/audit state by operation UUID; do not paste Auth response bodies, passwords, bearer tokens, full emails, raw IP addresses, or attempt snapshots into audit/debug logs. Login audit writes are best effort if the database is unavailable; a response is not evidence that an audit row was durable.

After any real destructive action, rollback must preserve permanent attempt tombstones, user lifecycle/generation fences, and durable operations/audit. Restoring an older full database snapshot over those records can resurrect removed exams/accounts and is not an acceptable application rollback. Rehearse a forward repair or selective restore that retains the newer fences; review it with the operator responsible for the deletion before execution. There is no tombstone purge job in this version.
