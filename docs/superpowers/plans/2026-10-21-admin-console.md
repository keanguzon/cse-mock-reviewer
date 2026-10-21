# Admin Console Implementation Plan

Implementation checkpoint (2026-10-21): the user subsequently authorized implementation, checkpoint commits, and pushes to `CSE-reviewer-v1.5`. The database, authentication, console, and reviewer integration are committed. Local verification passed 169 bank tests, 64 unit tests, 31 PGlite integration tests, type checking (0 errors; 68 existing warnings), production build, and the isolated browser flows described in the operator runbook. Production migration/provisioning and real Supabase/PostgREST/Auth/Storage checks remain separate release gates. The unchecked original steps below preserve the approved planning checklist; they are not a claim that every deployment/browser matrix was executed.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for the recommended inline implementation after approval. Steps use checkbox (`- [ ]`) syntax for tracking. The main agent chooses the execution method; this plan recommends one focused independent security review after integration.

**Goal:** Add an isolated private admin console that safely manages individual users' exams, progress, and account deletion without changing the reviewer experience.

**Architecture:** SvelteKit server routes own admin authentication and service credentials; private Postgres tables own membership, sessions, selections, operations and audit. Per-user transactional RPCs enforce generation/tombstone fences, atomically rebuild progress, and replace existing direct reviewer writes. Browser UI uses the existing design system and the existing durable queue foundations.

**Tech Stack:** Installed Svelte 5 / SvelteKit 2, TypeScript, Supabase JS 2, Postgres, native crypto/IndexedDB, Bulma/Lucide, Vitest/fake-indexeddb/PGlite.

**Spec:** `docs/superpowers/specs/2026-10-21-admin-console.md` — read it in full before execution.

## Global Constraints

- Preserve existing reviewer routes, navigation, fonts, colors, component appearance, spacing, and button sizes.
- Reuse the existing dark purple theme, DM Sans body font, Syne brand, Bulma classes, Lucide icons, cards, inputs, and confirmation styling for admin screens. Add scoped admin CSS only.
- Do not add dependencies unless an implementation finding demonstrates a concrete need.
- Do not change question content, grading, exam configuration, or selection weights as part of this feature.
- No deployment, production database mutation, account provisioning, commit, or push is authorized by this planning request.
- Existing markdown files are ignored; preserve `.gitignore` and do not infer authorization from the older checkpoint.

## Review Focus

1. A stale offline client or still-valid deleted-user JWT must fail database reads/writes even outside the new UI — Task 2 authorization/fence tests.
2. Missing legacy snapshots and tied timestamps must yield honest coverage and deterministic surviving-answer state — Tasks 1/2 rebuild fixtures.
3. New attempts, reset, other admins, or altered ownership between preview and confirmation must invalidate sealed selection without broad deletion — Task 4 race tests.
4. An Auth timeout/crash after app-data removal or after Auth success must produce a recoverable operation and honest UI — Task 5 failure-injection tests.
5. Account changes, sleeping tabs, unknown legacy ownership, or unavailable IndexedDB must not mix users or falsely report saved — Task 6 tests and Task 8 browser checks.

---

## File ownership and interface map

Create `src/lib/admin/types.ts` for browser-safe request/result types; `src/lib/server/admin/{clients,session,csrf,queries,mutations,accountDeletion}.ts` for bounded server responsibilities; `src/lib/server/admin/crypto.ts` for token encryption/hashing only. Create `src/lib/performance.ts` for existing dashboard aggregation, `src/lib/reviewerData.svelte.ts` for authenticated generation/revision/cache lifecycle, and `src/lib/activeSession.ts` for owner/version validation.

Create `src/hooks.server.ts` for admin request guards and `src/routes/admin/+layout.svelte` for the admin shell; add the exact routes listed in Tasks 3–7. Modify `src/app.d.ts` to type admin locals. Root `src/routes/+layout.svelte` branches only its rendering/auth-listener behavior on `/admin` and renders its current reviewer markup unchanged for every other route.

Create two migrations: `supabase/migrations/20260730_reviewer_baseline.sql`, `supabase/migrations/20261021_admin_console.sql`; preserve `20260731_create_user_progress.sql`. Create `tests/integration/databaseHarness.ts`, `tests/integration/{adminDatabase,reviewerFences,adminDeletion}.test.ts`, `tests/unit/{performance,adminSession,adminSelection,adminAccountDeletion,reviewerData,activeSession}.test.ts`; extend existing attempt/queue tests. Create `docs/superpowers/admin-console-runbook.md` during implementation for local setup, provisioning, migration and release checks. No process files outside this scope are needed.

Shared types in `src/lib/admin/types.ts`:

`DataState={generation:number;revision:number;status:'active'|'deleting'|'deleted';progressCoverage:'complete'|'partial';incompleteAttemptCount:number}`; `AdminContext={adminId:string;sessionId:string;reauthenticatedAt:string|null}`; `OperationStatus='prepared'|'app_data_removed'|'auth_delete_pending'|'auth_delete_failed'|'complete'`; `MutationResult={operationId:string;status:OperationStatus|'succeeded';deletedCount:number;state:DataState}`.

`AttemptFilter={search:string;mode:'all'|'practice'|'mock';level:'all'|'professional'|'subprofessional';category:string|null;from:string|null;to:string|null;sort:'completed_at'|'percentage'|'category';direction:'asc'|'desc';page:number;pageSize:20|50}`. `SelectionInput={kind:'ids';ids:string[]}|{kind:'matching';filter:AttemptFilter}`; `SelectionPreview={selectionId:string;userId:string;ids:string[];count:number;expiresAt:string;generation:number;revision:number}`. Reject invalid UUIDs/enums/dates, search over 200 characters, page <1, and request bodies over 1 MiB (attempt/session RPC size cap 5 MiB).

Define in `admin/types.ts`: `UserFilter={search:string;status:'all'|'with-exams'|'without-exams'|'deletion-pending';sort:'name'|'email'|'created_at'|'last_completed_at';direction:'asc'|'desc';page:number;pageSize:20|50}`; `AuditFilter={action:string|null;status:string|null;targetId:string|null;page:number;pageSize:20|50}` with action/status validated against spec action/state enums. `UserSummary={id:string;email:string;displayName:string|null;createdAt:string;examCount:number;lastCompletedAt:string|null;protectedAdmin:boolean;status:DataState['status']}`; `UserDetail=UserSummary & {state:DataState;performance:PerformanceSummary;hasActiveSession:boolean}`. `AuditRow={id:string;actorId:string|null;targetId:string|null;operationId:string|null;action:string;status:string;count:number;createdAt:string}`; `Overview={reviewerCount:number;examCount:number;pausedCount:number;unresolvedDeletionCount:number}`.

### Task 1: Pin analytics, rebuild semantics, and migration baseline

**Files:** Create `src/lib/performance.ts`, `tests/unit/performance.test.ts`, `tests/integration/databaseHarness.ts`, `supabase/migrations/20260730_reviewer_baseline.sql`; modify `src/lib/components/Dashboard.svelte` and `package.json` only to add `test:integration` script.

**Interfaces:** In `performance.ts`, define `HistoricalAttempt={id:string;user_id:string;score:number;total:number;category:string;mode:string;level?:string|null;completed_at:string;questions?:Question[]|null;user_answers?:Record<number,string>|null}` and `PerformanceSummary={examCount:number;bestPercentage:number;averagePercentage:number;categories:{category:string;totalCorrect:number;totalQuestions:number;percentage:number}[];incompleteAttemptCount:number}`. Produce `summarizeAttempts(attempts: readonly HistoricalAttempt[]): PerformanceSummary` and `rebuildProgress(attempts: readonly HistoricalAttempt[]): {seen:string[];wrong:string[];incompleteAttemptCount:number}`. Pure rebuild is a test oracle for SQL, not production JS executed inside a DB transaction. Produce `createDatabaseHarness():Promise<{db:PGlite;asRole(role,userId,callback):Promise<unknown>;close():Promise<void>}>`.

- [ ] Write named tests: `uses_arithmetic_mean_not_weighted` asserts 1/1 and 0/9 average 50, best 100; `deleting_latest_correct_reveals_earlier_wrong`; `unanswered_is_wrong`; `ties_use_uuid`; `missing_snapshot_reports_partial`; `empty_and_zero_total_have_no_nan`; `specific_legacy_category_fallback_excludes_mixed`.
- [ ] Run `npm run test:unit -- tests/unit/performance.test.ts`; confirm meaningful failures before implementation.
- [ ] Implement the pure functions, extracting current dashboard semantics and leaving AnalyticsCard 90/80 thresholds unchanged. Preserve valid historical stored scores and classify partial snapshots without guessing IDs.
- [ ] Implement the PGlite harness with minimal auth.users/uid/jwt and anon/authenticated/service_role roles. Baseline migration creates actual current tables/columns idempotently before the existing progress migration; do not change current question IDs or load the question bank into SQL.
- [ ] Add `test:integration` as `vitest run --config vitest.integration.config.ts`. Add fresh migration replay and existing-manual-schema preservation fixtures with two users and legacy attempts; run targeted unit/integration tests, then verify dashboard preexisting aggregation fixtures still agree.

### Task 2: Enforce database fences and atomic reviewer/admin primitives

**Files:** Create `supabase/migrations/20261021_admin_console.sql`, `tests/integration/adminDatabase.test.ts`, `tests/integration/reviewerFences.test.ts`; extend harness from Task 1.

**Interfaces:** Reviewer public RPCs are `reviewer_data_state() -> DataState`, `save_attempt(p_attempt jsonb) -> {id,state}`, `save_active_session(p_session jsonb,p_generation bigint) -> DataState`, and `delete_active_session(p_session_id uuid,p_generation bigint) -> DataState`. Attempt JSON contains the existing CompletedAttempt plus required generation; active session JSON includes immutable sessionId and owner. SQL errors use stable codes mapped later to `STALE_GENERATION`, `ATTEMPT_DELETED`, `ACCOUNT_DISABLED`, `ID_CONFLICT`, `SELECTION_STALE`, `FORBIDDEN`. Produce private `rebuild_user_progress(p_user_id uuid)` called inside the caller's lock/transaction.

- [ ] Write fixtures that assert direct authenticated INSERT/UPDATE/DELETE on all three personal data tables is denied; owner SELECT allowed, user B/anonymous denied; public profile reads denied; stale JWT UID with missing Auth row denied; metadata `role=admin` has no effect.
- [ ] Write database tests for identical UUID retry returning once, conflicting retry rejection, tombstoned retry rejection, generation omission/mismatch, late submissions using chronological order, reset-vs-save serialization, unanswered/timestamp-tie/partial legacy rebuild, invalid totals and oversized snapshots. Verify B's history/progress/state byte-for-byte unchanged after A mutations.
- [ ] Run `npm run test:integration -- tests/integration/adminDatabase.test.ts tests/integration/reviewerFences.test.ts` and observe failures.
- [ ] Create private tables described in the spec, with no cascading Auth FKs on lifecycle/tombstones/audit/operations. Add/backfill generation 0 without a new-write default; safely change progress Auth FK to cascade. Revoke direct grants/default function PUBLIC execution, remove permissive policies, and pin qualified SECURITY DEFINER helpers. Live-user/lifecycle checks govern all personal reads and RPC writes.
- [ ] Implement state-locking reviewer RPCs and transactional insert/rebuild/matching-session cleanup, plus service-only reset/delete primitives that atomically fence/rebuild/audit. Admin primitives require service context and current membership, deny self/current admin targets, and lock target state. Attempt snapshots are immutable; sorted sets match Task 1's oracle.
- [ ] Run the targeted tests and fresh/manual-schema replay; assert exact grants/policy inventories, no user data loss, and no authenticated execution of service-only functions. Database unavailable/failure never partially commits a deletion/rebuild.

### Task 3: Isolated administrator authentication and request guard

**Files:** Create `src/lib/admin/types.ts`, `src/lib/server/admin/{clients,crypto,session,csrf}.ts`, `src/hooks.server.ts`, `tests/unit/adminSession.test.ts`, `src/routes/admin/login/+page.server.ts`, `src/routes/admin/login/+page.svelte`, `src/routes/admin/logout/+server.ts`, `src/routes/admin/reauth/+server.ts`; modify `src/app.d.ts`, root `src/routes/+layout.svelte`.

**Interfaces:** `requireAdmin(event:RequestEvent):Promise<AdminContext>`; `loginAdmin(event,email,password):Promise<void>`; `logoutAdmin(event):Promise<void>`; `reauthenticateAdmin(event,password):Promise<AdminContext>`; `requireAdminMutation(event,context):Promise<void>`. Helpers use server-only env and dependencies injectable in tests. Hook assigns `event.locals.admin` only after verification. Route handlers always use these guards; do not rely on layout load alone.

- [ ] Write tests for valid password/current membership; wrong password and nonmember returning the same message; Google reviewer token/forged cookie/metadata-role failing; membership revoked between requests; missing env and auth outage failing closed; token expiry <=60 minutes; cookie flags/path; encrypted stored access token; no refresh token persistence; rate limit fifth failure then 429; attacker Origin, missing CSRF, wrong content-type and unsafe redirect denied.
- [ ] Run `npm run test:unit -- tests/unit/adminSession.test.ts` and observe failures.
- [ ] Implement ephemeral credential client + separate service client, random hashed opaque sessions, AES-GCM at rest, server DB throttle, short preauth nonce and session CSRF verification. Check current membership for every request. Reauth verifies the current admin's password, rotates secrets, and marks server timestamp; never trust a submitted email/admin ID. Logout only removes admin session.
- [ ] Add root `/admin` branch to suppress reviewer navigation/auth initialization on admin pages, preserving all current nonadmin markup and restoring reviewer auth initialization when navigating back. Build a basic admin login using existing styles with loading/error states and accessible labels.
- [ ] Run unit tests and `npm run build`; inspect client output for private env names/value canaries. Assert admin page data never includes access/session secrets and reviewer storage/session is unaffected by login/logout.

### Task 4: Query APIs, sealed selections, and atomic exam deletion/reset

**Files:** Create `src/lib/server/admin/{queries,mutations}.ts`, `tests/unit/adminSelection.test.ts`; extend `tests/integration/adminDatabase.test.ts`. Create routes `src/routes/admin/api/overview/+server.ts`, `users/+server.ts`, `users/[id]/+server.ts`, `users/[id]/attempts/+server.ts`, `users/[id]/selections/+server.ts`, `users/[id]/selections/[selectionId]/exclude/+server.ts`, `users/[id]/delete-attempts/+server.ts`, `users/[id]/reset/+server.ts`, `audit/+server.ts` under the same admin API folder.

**Interfaces:** `listUsers(ctx,query:UserFilter):Promise<Page<UserSummary>>`; `getUserDetail(ctx,userId):Promise<UserDetail>`; `listAttempts(ctx,userId,filter:AttemptFilter):Promise<Page<HistoricalAttempt>>`; `createSelection(ctx,userId,input:SelectionInput):Promise<SelectionPreview>`; `excludeFromSelection(ctx,userId,selectionId,excludedIds:string[]):Promise<SelectionPreview>`; `deleteSelectedAttempts(ctx,userId,selectionId,operationId):Promise<MutationResult>`; `previewUserReset(ctx,userId):Promise<SelectionPreview>`; `resetUserProgress(ctx,userId,selectionId,operationId):Promise<MutationResult>`; `getOverview(ctx):Promise<Overview>` and `listAudit(ctx,query:AuditFilter):Promise<Page<AuditRow>>`. `Page<T>={items:T[];total:number;page:number;pageSize:20|50}`. Reset POST discriminates `{action:'preview'}` or `{action:'execute',selectionId,operationId}`; other mutations carry operation/selection IDs as appropriate. Context always comes from the guard.

- [ ] Write `page_selection_never_expands`, `all_matching_freezes_ids_immediately`, `excluding_from_snapshot_cannot_broaden`, `new_attempt_invalidates_preview`, `reset_preview_rejects_new_attempt_or_session`, `cross_user_ids_rejected`, `expired_and_other_session_selection_rejected`, `stale_membership_or_new_admin_target_rejected`, `duplicate_operation_returns_original`, `operation_id_conflicting_body_rejected`. Assert invalid query values and wildcard search escaping, fixed sort allowlists, and stable UUID ties.
- [ ] Run selection unit/integration tests and confirm failures.
- [ ] Implement bounded, parameterized DB queries behind service-only RPCs; directory includes protected admins and derives counts without leaking Auth metadata. Return summary over all remaining exams, independent of history filters. Seal matching IDs immediately at the select-all action, explicit IDs at preview, and reset scope at its preview, each with five-minute expiry and owner/session/revision/generation/one-use state. Derive exclusions only from the parent frozen snapshot and reseal the subset without rerunning its query.
- [ ] Implement preview consumption and reset as per-user transactions with rechecked current membership and protected target. Return 409 for changed revision/targets; save outcome/audit in the transaction with idempotency fingerprint. A repeat operation returns the original result without consuming a new selection. Never accept raw query text or caller-supplied actor ID.
- [ ] Run tests and inject a progress rebuild failure: tombstones, attempts, progress, revision and audit must all roll back. Test target A only and unaffected B for single delete, cross-page bulk delete, empty survivors, and full reset.

### Task 5: Durable, recoverable Auth account deletion

**Files:** Create `src/lib/server/admin/accountDeletion.ts`, `src/routes/admin/api/users/[id]/delete-account/+server.ts`, `src/routes/admin/api/operations/[id]/retry/+server.ts`, `tests/unit/adminAccountDeletion.test.ts`, `tests/integration/adminDeletion.test.ts`; extend migration service-only operation functions.

**Interfaces:** `deleteUserAccount(ctx,userId,{operationId,typedEmail}):Promise<MutationResult>`; `retryAccountDeletion(ctx,operationId):Promise<MutationResult>`. Private DB phases: `prepare_account_delete(actor,session,target,operation_id,typed_email)`, `claim_account_delete(operation_id)`, `finish_account_delete(operation_id,outcome,error_code)`; only server service caller invokes them. The DB checks stored session reauth <=5 minutes and membership; request timestamp flags cannot confer freshness.

- [ ] Write failure-injection tests: no Auth call when prepare fails; protected self/admin/current email mismatch/recent auth failure; app data fenced before Auth call; Auth error leaves `auth_delete_failed`; network uncertainty leaves pending; successful Auth then DB failure reconciles on retry; already absent Auth completes; repeated/concurrent retries have one execution lease; operation UUID cannot target B; stale JWTs cannot read/write while deleting or deleted.
- [ ] Run targeted unit/integration tests and observe failures.
- [ ] Implement durable phase transitions, immutable request fingerprint, 30-second renewable execution lease, and attempt/error metadata. Before Auth call recheck current admin/target membership; target membership provisioning must reject nonactive lifecycle so it cannot race console deletion. Call `auth.admin.deleteUser(id,false)` only after committed removal; verify already-absent outcomes with admin getUserById. Do not delete Storage objects or roll back fences on failure.
- [ ] Implement finalization and explicit retry authorization: same or another current admin may resume an operation, with recent reauth for retry; keep target checks, surviving lifecycle/tombstones/audit, and accurate partial status. Redact credential/PII/error response content before audit.
- [ ] Run tests; verify ON DELETE behavior by deleting test auth.users only in the isolated DB fixture, preserving operation/fences and denying the old UID. Real Supabase API semantics remain a Task 8 disposable integration gate.

### Task 6: Wire reviewer saving and cache invalidation to the fences

**Files:** Modify `src/lib/{attempts.ts,pendingAttempts.ts,attemptSync.ts,syncStore.svelte.ts,userSession.svelte.ts}`, `src/lib/components/{ResultScreen.svelte,AnalyticsCard.svelte,Dashboard.svelte}`, `src/routes/{+page.svelte,quiz/+page.svelte,quiz/+page.ts,exams/+page.svelte,submission/[id]/+page.svelte,api/questions/+server.ts}`. Create `src/lib/{reviewerData.svelte.ts,activeSession.ts}`, `tests/unit/{reviewerData,activeSession}.test.ts`; extend current attempt/queue tests and fixtures.

**Interfaces:** Add required `generation:number` to CompletedAttempt, preserve immutable ID/completed_at, add `discarded` SaveState. `createAttemptSync` consumes a typed send failure `{code:'STALE_GENERATION'|'ATTEMPT_DELETED'|'ACCOUNT_DISABLED'|'RETRYABLE'}` and optional `onDiscard(attempt,code)`; terminal fences remove only the rejected owner's record and publish discarded, while retryable errors stay queued. `reviewerData.refresh(reason:'auth'|'focus'|'online'|'pageshow'|'interval'|'save'):Promise<DataState|null>` exposes current owner/state and invalidation subscription. `validateActiveSession(value,ownerId,generation)` validates version/owner/generation/sessionId before restore.

- [ ] Write tests for immutable ID/timestamp/generation across lost-response retry, reload and duplicate result mounts; generation captured at start; terminal tombstone/reset vs network queue behavior; account switch during drain; quota failure; legacy queue generation 0 only; unknown-owner local active-session quarantine; generation invalidation purges only owner A; late response cannot update B; conditional active-session deletion preserves a newer session.
- [ ] Run targeted unit tests and confirm failures before replacing old direct writes.
- [ ] Wire durable repository/coordinator into syncStore, serialize legacy import after authoritative owner state, and call `save_attempt`. Quiz/session flow creates UUID once, persists owner/generation/session identity, uses session RPCs, and reuses original snapshot on retries. Extend existing save indicator copy/status without changing its layout/buttons; never claim account saved on enqueue.
- [ ] Implement focus/online/pageshow/60-second visible polling and BroadcastChannel with storage-event fallback for invalidation. Revision refreshes mounted dashboard/history/submission/paused state; generation reset clears stale owner caches, stops in-flight save and uses existing dialog/status to require restart. Deleted submission opens an unavailable state. Guest data/preferences and valid unaffected in-flight exams survive.
- [ ] Remove shared Supabase browser client from the questions server endpoint; verify bearer using a request-scoped client and derive identity rather than trusting URL userId. Preserve current selection body/weights, read the rebuilt progress via owner RLS, and test spoofed userId plus missing/deleted bearer. Direct/reload quiz obtains fresh owner progress before the personalized request when auth is available; guest remains supported.
- [ ] Run all unit/integration tests; assert no reviewer `.insert/.upsert/.update/.delete` direct calls remain on fenced personal tables. Integration proves delete/reset followed by offline drain cannot resurrect exams/progress/session or affect B.

### Task 7: Admin screens, selection UX, and audit feedback

**Files:** Create `src/routes/admin/+layout.svelte`, `+layout.server.ts`, `+page.svelte`, `+page.server.ts`, `users/+page.svelte`, `users/[id]/+page.svelte`, `audit/+page.svelte`; create `src/lib/components/admin/{UserTable,AttemptTable,SelectionToolbar,ConfirmDialog,UserDangerZone,AuditTable}.svelte`. Extend `tests/unit/adminSelection.test.ts` with browser-independent selection reducer tests in `src/lib/admin/selection.ts`.

**Interfaces:** In `admin/selection.ts`, `SelectionState={scopeKey:string;mode:'none'|'explicit'|'matching';ids:string[];selectionId:string|null}` and `SelectionEvent` is a discriminated union of `{type:'toggle-row';id:string}`, `{type:'toggle-page';ids:string[]}`, `{type:'seal';preview:SelectionPreview;mode:'explicit'|'matching'}`, `{type:'clear'}`, `{type:'scope';scopeKey:string}`. `selectionReducer(state,event):SelectionState` returns deduplicated selected IDs; count derives from ids.length. After a matching uncheck, the parent calls excludeFromSelection and seals its returned subset as explicit. Confirmation emits only selectionId/operationId; danger zone requests sealed reset preview or typed-email delete and reauth; parent owns network/error lifecycle. Server layout exposes sanitized admin identity and CSRF token only, never credentials. UI reads Task 4/5 endpoints; mutations invalidate current user/overview/audit after confirmed responses.

- [ ] Test zero/page/all matching/indeterminate counts, cross-page preservation, scope-change clear, matching-row exclusion, repeated busy click suppression, and 409 forcing a new preview. Run tests to fail before implementing reducer.
- [ ] Implement overview/directory/detail/audit within existing theme, with specified 20/50 pagination, query/filter/sort/Refresh, loading/error/empty and protected admin states. Keep user performance summary visibly scoped to all surviving exams. Snapshot review uses safe text rendering.
- [ ] Implement confirmation flow for one/selected exams, separate progress reset, two-step typed-email account deletion and password reauth; reflect partial/pending/failed operation status and explicit Retry. No bulk account selection or role controls.
- [ ] Implement focus trap/Escape/focus return, labeled checkbox/indeterminate state, aria-live count/status, responsive contained table overflow and wrapping toolbars using admin-scoped styles. Run unit tests and `npm run build`.

### Task 8: Verify end-to-end behavior and prepare a reviewable release

**Files:** Create `docs/superpowers/admin-console-runbook.md`; update new spec/plan status only after observed implementation milestones. Do not rewrite unrelated old checkpoint claims.

- [ ] Capture current and final `npm test`, `npm run test:integration`, `npm run check`, `npm run build`; distinguish existing type errors from introduced errors. Scan built browser output with secret canaries, verify server-only imports, and review the full diff for unrelated UI/schema changes.
- [ ] Run browser checks at 1440px and 390px: reviewer Google session concurrent with separate admin login/logout; nonadmin direct pages/APIs denied; keyboard-only login/selection/dialogs; page-only vs explicit all-matching bulk deletion; filtering/pagination/clear; exact confirmation count; user A analytics recalculated; user B unchanged; protected admins; hard-delete double confirmation/re-auth; honest failed Auth retry. Capture before/after reviewer screenshots for unchanged route geometry/button sizes.
- [ ] Exercise two tabs and offline/reconnect: queued tombstoned attempt, reset with paused/in-flight exam, old client missing generation, same-UUID retry, auth switch and stale submission URL. Assert cache refresh on focus and <=60 seconds while visible; document that offline remote caches persist until reconnect. Report browser viewport tests separately from physical-device checks.
- [ ] Run disposable real Supabase checks only if local/disposable environment is available: migration fresh replay and manual-schema upgrade; anon/owner/B direct PostgREST grant/RLS checks, stale deleted-user JWT, revoked admin membership, Auth API deletion/owned-Storage failure/retry. Never use production users as fixtures. If unavailable, report this as an outstanding deployment gate rather than claiming PGlite proves Supabase behavior.
- [ ] Write runbook with exact environment setup, operator-only separate confirmed email/password admin provisioning and private membership insert, safe migration-history baselining after schema introspection, backup/restore rehearsal, deployment-host server capability, coordinated DB/client rollout and smoke checks. Account provision/grants/live migration remain approval-bound operator steps; do not run them during local implementation.
- [ ] Review spec coverage and security boundaries against final code; main validates one focused independent security review of auth, RLS/fences, sealed operations and Auth partial failures, resolving findings before delivery. Deliver local changes, test/browser evidence and remaining limitations for approval. Do not commit/push/deploy unless newly authorized; markdown remains ignored and is linked directly for review. Recommend inline implementation only after the user approves this plan.

## Plan self-review

Coverage: all requested screens and selection controls map to Tasks 4/7; identity, session separation and CSRF to Task 3; analytics and chronological rebuild to Tasks 1/2; irreversible fence semantics and legacy direct clients to Tasks 2/6; Auth partial failures/idempotency/audit to Task 5; replay, deployment boundaries and real Supabase/browser verification to Task 8. The five Review Focus risks each have named owning tests.

Scope: no application code or live changes were made while writing this plan. Shared types use one owner; the SQL rebuild is verified against the pure oracle. Implementation is sequential because authorization, database RPCs, UI, and queue integration share contracts. No new runtime service, worker, role editor or general reliability redesign is required. PGlite cannot verify external Auth/PostgREST/Storage, hosting suitability and deployed policy drift; these remain explicit release gates.
