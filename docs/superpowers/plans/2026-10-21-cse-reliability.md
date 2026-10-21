# CSE Corrections and Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Native inline execution is recommended for this project; the user has not selected an execution method for this plan yet.

**Goal:** Correct question content and backend reliability, add verified official-format mock options, and retain the approved experience and legacy 170-question Extended Mock.

**Architecture:** Retain SvelteKit/Svelte, JSON question banks, Supabase Auth/Postgres/RLS, and client grading. Isolate the persistence fix behind a typed durable browser queue and a transactional Supabase RPC; extract only the small exam-profile/selection/session helpers required for regression tests. Deliver independently reviewable milestones instead of a broad rewrite.

**Tech Stack:** Svelte 5, SvelteKit, TypeScript, Supabase JS/Postgres, native IndexedDB, Bulma; Node built-in tests for bank tooling, Vitest and fake-indexeddb as development-only dependencies for application logic, pgTAP/local Supabase for database integration.

**Spec:** `docs/superpowers/specs/2026-10-21-cse-reliability.md`.

## Global Constraints

- Preserve the existing appearance, CSS, button sizes, spacing, fonts, colors, animations, navigation, routes, and control placement.
- Retain client-side grading, answer keys in the client, and existing practice-mode rules.
- Preserve all existing question IDs, categories, per-file counts, and the 1,850-question total; repair defective questions in place.
- Preserve historical scores, answer snapshots, and paused-exam question snapshots. Never silently regrade old attempts using the corrected bank.
- Allow only question corrections, accurate text in the existing save indicator/error dialogs, and the approved exam-option labels/configuration to change visible content. Error feedback reuses existing dialog controls and styling.
- Official professional: 150 scored questions / 190 minutes; official subprofessional: 145 / 160. Keep 170 / 191 and 165 / 185 as Extended Mock.
- No production database writes, deployment, commit, or push is authorized by this planning request.
- Do not turn this work into a redesign, new dashboard, server-side grading system, realtime rewrite, or infrastructure scaling project.

## Review Focus

1. A failed/ambiguous request after server commit must retry with the same attempt ID and leave exactly one immutable result (Tasks 3-4).
2. Legacy active sessions have no owner/profile metadata; never adopt another person's data or alter an existing exam's duration (Tasks 5-6).
3. Account changes during asynchronous work must not render, sync, or delete the previous owner's state under the new owner (Tasks 4-5).
4. Tiny quotas, depleted subcategories, and out-of-sync seen/wrong arrays must not overproduce, duplicate, or stall an exam (Task 6).
5. A corrected question must have one defensible answer, while an old paused/submitted snapshot continues to use its original content (Tasks 1-2, 5-6).

---

## Milestones and dependencies

1. **Content:** Tasks 1-2. Independently shippable bank corrections and tooling.
2. **Persistence/privacy:** Tasks 3-5. Task 4 uses the Task 3 RPC; Task 5 shares the attempt identity/status contract.
3. **Exam options/API:** Task 6. Can be developed after Task 1; integrate after session compatibility is settled in Task 5.
4. **Dependencies/regression:** Tasks 7-8. Re-run earlier gates against the upgraded stack.

Each completed task is a review checkpoint. Commit only if the user separately authorizes commits; stage only that task's named files. Suggested commit messages are included for that future case. Push/deployment remains separate.

## Execution preflight

- [ ] Re-read the spec, actual Git state, repository instructions, and current sources. Do not assume earlier review line numbers still match. Verify a working Git executable; the current Windows git shim fails with a path error.
- [ ] Follow using-git-worktrees at execution time if isolation is needed; reuse a suitable managed worktree and preserve unrelated edits. Do not create one during planning.
- [ ] Record existing question IDs/counts, representative legacy storage/snapshots, package lock versions, and before screenshots on local fixtures. Keep credentials/tokens out of fixtures and logs.
- [ ] Install locked development dependencies with `npm ci` once implementation is approved. Run `npm run check` and `npm run build` to record the baseline before changes; distinguish pre-existing errors from regressions.
- [ ] Local Supabase/Docker are not currently detected. Provision local test tooling during execution if available; if unavailable, keep the SQL prepared but explicitly report integration checks as unperformed. Never substitute production as the test target.
- [ ] The existing `.gitignore` ignores all Markdown files. Leave it unchanged in this batch; when documentation staging is authorized, force-add only the exact spec/plan/runbook files, never the whole docs tree.

## File responsibility map

| Area | Files and responsibility |
| --- | --- |
| Bank integrity | `validate_questions.cjs`; `tests/questions/bank.test.cjs`; `tests/questions/corrections.json`: structural validation and independently expected correction fixtures |
| Content evidence | `docs/content/question-review.json`: ID-keyed editorial evidence/coverage; source bank JSON files: actual questions |
| Script regressions | `fix_logic_bias.cjs`, `scripts/add_10_new_gen_info.cjs`, `tests/questions/maintenance.test.cjs`: safe/idempotent maintenance behavior |
| Test harness | `vitest.config.ts`, `vitest.integration.config.ts`, `package.json`, `package-lock.json`: node tests plus compatible Vitest/fake-indexeddb setup; database integration has an explicit separate command |
| Shared attempt types | `src/lib/attempts.ts`: immutable attempt payload, status, and validation contracts |
| Durable queue | `src/lib/pendingAttempts.ts`: IndexedDB schema, transactions, legacy queue import |
| Synchronization | `src/lib/attemptSync.ts`: owner-filtered RPC drain with injected repository/client; `syncStore.svelte.ts`: thin reactive adapter |
| Active sessions | `src/lib/activeSession.ts`: snapshot validation, owner-scoped storage, checkpoints, cloud save/clear behavior |
| Exam config/selection | `src/lib/examConfig.ts`: profiles/timing/compatibility; `src/lib/questionSelection.ts`: pure bounded quota selection |
| Database | New ordered migrations, local pgTAP tests, `supabase/config.toml`, and `docs/operations/cse-database-upgrade.md`: reproducible bootstrap and safe additive upgrades |
| Product wiring | Existing route/component script blocks plus existing save-status text and dropdown options only; keep CSS and DOM layout intact |

### Task 1: Pin bank integrity and add the minimal regression harness

**Files:** Modify `validate_questions.cjs`, `package.json`, `package-lock.json`. Create `tests/questions/bank.test.cjs`, `tests/questions/corrections.json`, `vitest.config.ts`, `vitest.integration.config.ts`, `docs/content/question-review.json`.

**Interfaces:** Export `validateQuestionBank(files: Array<{name: string, questions: unknown}>, expectedCounts: Record<string, number>): {errors: string[], total: number}` from the CJS validator. Keep the existing CLI entry point and output summary. `corrections.json` contains independent expected values for the spec's confirmed IDs, not values copied dynamically from the bank under test.

- [ ] **Step 1:** Write Node tests for mixed valid 50/75/100 file counts, wrong-type records, missing fields, duplicate IDs across files, duplicate choice strings, and keys absent from choices. Assert duplicate IDs create errors and CLI exit code 1 using a temporary fixture directory; make the CLI accept `--dir` for fixtures.
- [ ] **Step 2:** Run `node --test tests/questions/bank.test.cjs`; record the failing count/exit-code cases against the old behavior.
- [ ] **Step 3:** Refactor the validator behind the exported interface; require nonempty string fields, exactly four distinct choices, exactly one matching key, unique IDs, and the explicit per-file count manifest. Guard CLI execution with `require.main === module`. Record the actual 23-file baseline, including exact IDs.
- [ ] **Step 4:** Add scripts `test:bank` = `node --test tests/questions/*.test.cjs`, `test:unit` = `vitest run`, `test:integration` = `vitest run --config vitest.integration.config.ts`, and `test` that runs bank then unit tests. Add compatible stable Vitest and fake-indexeddb as devDependencies, after checking current peer requirements. `vitest.config.ts` uses a node environment, includes only `tests/unit/**/*.test.ts`, and defines explicit source aliases/mocks; `vitest.integration.config.ts` extends it but includes only `tests/integration/**/*.test.ts`. Do not change production Vite config for the test runner. Unit success cannot substitute for a separately recorded integration run.
- [ ] **Step 5:** Run `npm run test:bank` and `node validate_questions.cjs`; require zero structural errors and exactly 1,850 unique IDs. No editorial certification is implied by this pass. Checkpoint: `test: enforce question bank integrity`.

### Task 2: Correct the bank and prevent maintenance regressions

**Files:** Modify these exact files under `src/lib/questions/`: `numerical_age_problems.json`, `numerical_work_problems.json`, `numerical_number_series.json`, `analytical_assumptions.json`, `analytical_data_interpretation.json`, `clerical_filing.json`, `analytical_logic.json`, `verbal_balarila_filipino.json`, `verbal_correct_usage.json`, `verbal_grammar.json`, `general_info_current_events.json`, `general_info_constitution.json`. Also modify any other bank file only when the file-by-file review verifies an additional concrete defect and records it in the ledger. Modify `fix_logic_bias.cjs`, `scripts/add_10_new_gen_info.cjs`; create `tests/questions/maintenance.test.cjs`; extend Task 1 fixtures and ledger.

**Interfaces:** Consume Task 1 validator and correction fixtures. Retain the existing `Question` fields and exported bank functions. Add no runtime editorial fields or choice-shuffling behavior.

- [ ] **Step 1:** In `tests/questions/bank.test.cjs`, define the helper `byId(id)` to return the matching object from the JSON files loaded directly from disk, and add independently calculated assertions for every confirmed correction row in the spec. Examples:

```js
assert.equal(byId('14053').correct_answer, '30 days');
assert.equal(byId('2044').correct_answer, 'Box 3');
assert.equal(byId('5017').correct_answer, 'D-C-B-A');
assert.equal(byId('8056').correct_answer, '11 member states');
```

For explanation-only fixes, assert the required formula/provision or logical conclusion and manually inspect the prose; do not infer correctness from matching the key alone. Add independent permutation checks for 2024/2033/2051/2063/2071 and a single-valid-choice review for language items.
- [ ] **Step 2:** Run `npm run test:bank`; confirm existing incorrect keys/premises fail the new regressions.
- [ ] **Step 3:** Edit JSON directly according to the spec's correction register, updating stem, distractors, key, and explanation together. Verify primary internet sources and record dates/URLs; use explicit filing conventions and remove explanation drafts that change the premise mid-solution. Preserve IDs, categories, counts, and stored historical snapshots.
- [ ] **Step 4:** Review remaining bank records file by file. For each, record actual review status/method; recompute every PEMDAS expression with a restricted arithmetic parser and inspect numerical/logic answers independently. Any newly found ambiguity is repaired in place with its own failing regression and ledger entry. No unresolved confirmed defect may be called fixed.
- [ ] **Step 5:** Export `swapConclusionLabels(explanation)` from `fix_logic_bias.cjs` and `appendUniqueQuestions(existing, incoming)` from `scripts/add_10_new_gen_info.cjs`, with their existing file-writing entry points guarded by `require.main === module`. Test only temporary copies: applying the Roman-label transform once maps I to II and II to I consistently; adding the fixed-ID seed set twice leaves the same 10 unique IDs. Implement a single label replacement pass and ID-based seed insertion. Importing either module must not write files.
- [ ] **Step 6:** Run `npm run test:bank`, `node validate_questions.cjs`, `node check_distribution.cjs`, and `npm run check`. Require unchanged per-file counts/IDs, passing correction cases, and an honest editorial coverage summary. Position bias is reported, not silently fixed by shuffling. Checkpoint: `fix: correct verified CSE practice questions`.

### Task 3: Make database writes atomic and profiles private

**Files:** Create `supabase/config.toml` through the local Supabase CLI if absent; create `supabase/migrations/20260730000000_base_schema.sql`, `supabase/migrations/20261021000100_private_profiles.sql`, `supabase/migrations/20261021000200_atomic_attempt_save.sql`, `supabase/tests/database/cse_rls.test.sql`, `supabase/tests/database/save_attempt.test.sql`, `tests/integration/saveAttemptConcurrency.test.ts`, and `docs/operations/cse-database-upgrade.md`. Modify the profile policy in `schema.sql` to match owner-only semantics. Preserve `20260731_create_user_progress.sql` as historical migration; do not modify its applied version.

**Interfaces:** Add `public.save_exam_attempt(p_attempt jsonb) RETURNS uuid`, SECURITY INVOKER with an explicit safe search_path. Payload fields are `id`, `user_id`, `score`, `total`, `category`, `mode`, `level`, `completed_at`, `questions`, `user_answers`; optional `active_session_id` identifies the session being completed. It returns the durable attempt UUID after both attempt/progress work succeeds. Callers still compute grades.

- [ ] **Step 1:** Write local database tests for anonymous/profile denial, owner reads, cross-user attempt/progress/session denial, valid save, duplicate UUID replay, conflicting same-UUID payload, rollback on progress failure, and deleting an auth user with progress. Add a two-client integration test asserting disjoint concurrent saves retain both sets of progress IDs. Integration tests must refuse any URL outside localhost/127.0.0.1/::1; test credentials are local fixtures only.
- [ ] **Step 2:** Start only the verified local stack. Run `supabase test db`; record failing privacy/atomicity/cascade cases. For existing-schema reproduction, load the current root SQL files in order plus the original progress migration in an ephemeral local database, not the user's host.
- [ ] **Step 3:** Add a fresh-install base migration for questions/profiles/attempts/active_sessions and existing JSON columns, ordered before the original progress migration. New migrations replace the permissive profile SELECT policy with owner-only authenticated SELECT, preserve owner update access with WITH CHECK, and revoke anonymous profile access. Add the progress cascade FK. Do not delete user rows or regrade data.
- [ ] **Step 4:** Implement the RPC transaction: validate authenticated owner, UUID, score bounds, `1 <= total <= 2000`, supported mode/level, array-shaped questions of length total, and object-shaped indexed answers; reject invalid payloads before writes. Create/lock the owner's progress row, insert the attempt once by its primary UUID, and merge progress only for a newly inserted attempt. Matching owner replay returns the existing UUID without overwriting anything; mismatching replay raises an error. Wrong/correct IDs retain the current learning semantics; unanswered items count as wrong. Exceptions roll back both operations. Restrict execute to authenticated and revoke PUBLIC/anon; retain RLS and client grading.
- [ ] **Step 5:** Clear the cloud active session only when its stored attempt identity equals optional `active_session_id`; an old completion must not delete a newer exam. For new row checks use NOT VALID constraints where necessary to avoid rejecting historical rows during migration; RPC validation still covers every new request. Do not silently validate/drop old data.
- [ ] **Step 6:** On the verified disposable local project run `supabase db reset --local`, `supabase test db`, and `npm run test:integration`. Require a clean replay plus the existing-schema upgrade fixture to preserve all sample history. Document existing production migration-history reconciliation and backup/preflight SQL without executing it. Checkpoint: `fix: secure profiles and save attempts atomically`.

### Task 4: Make the offline queue durable and statuses truthful

**Files:** Create `src/lib/attempts.ts`, `src/lib/pendingAttempts.ts`, `src/lib/attemptSync.ts`, `tests/unit/pendingAttempts.test.ts`, `tests/unit/attemptSync.test.ts`. Modify `src/lib/syncStore.svelte.ts`, `src/lib/guestStore.svelte.ts`, `src/lib/userSession.svelte.ts`, `src/routes/+layout.svelte`, `src/lib/components/ResultScreen.svelte`, `src/lib/components/AnalyticsCard.svelte`.

**Interfaces:**

```ts
type SaveState = 'saving' | 'queued' | 'saved' | 'local' | 'error';
type CompletedAttempt = {
  id: string; user_id: string; score: number; total: number;
  category: string; mode: 'practice' | 'mock';
  level: 'professional' | 'subprofessional'; completed_at: string;
  questions: Question[]; user_answers: Record<number, string>;
  active_session_id?: string;
};
type PendingAttempt = { attempt: CompletedAttempt; queued_at: string };
interface PendingRepository {
  put(item: PendingAttempt): Promise<void>;
  list(userId: string): Promise<PendingAttempt[]>;
  remove(id: string): Promise<void>;
}
```

`Question` is the existing exported type. `createAttemptSync({repository, send, getUserId, onState})` in `attemptSync.ts` returns `enqueue(item: PendingAttempt): Promise<void>`, `drain(): Promise<void>`, and `retry(id: string): Promise<void>`. `send(attempt: CompletedAttempt): Promise<string>` invokes Task 3 RPC; `getUserId(): string | null`; `onState(id: string, state: SaveState): void`. The Svelte store exposes reactive per-ID states plus existing pending/syncing getters; components do not access IndexedDB directly. ResultScreen accepts optional `attemptId: string` and `completedAt: string` props; until the quiz supplies them in Task 5, it generates each once per mounted result and reuses them for Retry. Extend guestStore.save's existing input with optional id/completed_at, deduplicate by id, preserve its 20-summary cap, and throw when local persistence fails.

- [ ] **Step 1:** Write deferred-promise/fake-indexeddb tests for adding B during A's drain; two repositories writing different IDs; failed durable storage; server success with lost response; progress RPC failure; account switch during drain; startup already online; and retry after reload. Assertions: each intended attempt exists exactly once remotely or remains durably queued, no other owner's work is sent, and completed_at is unchanged.
- [ ] **Step 2:** Run `npx vitest run tests/unit/pendingAttempts.test.ts tests/unit/attemptSync.test.ts`; confirm missing/new contracts fail before implementation.
- [ ] **Step 3:** Implement IndexedDB database `cse-reviewer`, version 1, object stores `pending_attempts` keyed by attempt.id and `meta` keyed by key. Use transactions for puts/deletes and an owner/queued_at index; remove only the acknowledged ID, never replace a queue snapshot. Import valid `cse_pending_attempts` records with deterministic payload-derived UUIDs and original queued_at as best available legacy completed_at. Commit destination/marker before deleting legacy storage; interrupted imports are idempotent. Preserve invalid raw records in a quarantine entry for manual recovery. Never infer duplicates against historical server rows lacking a stable shared ID.
- [ ] **Step 4:** Implement the owner-filtered coordinator with try/finally syncing cleanup, oldest-first batches, and stable-ID retries. A drain rechecks auth before each send and ignores stale-owner status updates; already-sent old-owner requests remain protected by their original JWT/RLS. Concurrent tab sends are safe through the RPC's idempotency and per-record queue deletion.
- [ ] **Step 5:** Wire startup/login/online triggers outside the synchronous Supabase auth callback; use a deferred callback so awaited database/auth calls do not deadlock auth initialization. Return/remove listeners on layout teardown. Keep the original Supabase auth subscription cleanup contract.
- [ ] **Step 6:** Wire the existing result/status area to the actual attempt state. Exact messages: saving = `Saving review progress...`; queued = `Saved on this device. Waiting to sync.`; saved = `Progress saved to your account!`; local = `Progress saved on this device.`; error = `Couldn't save this attempt.` Existing Retry uses the same attempt ID. Guest save must report storage errors rather than unconditional success. Do not change CSS, icons, button sizes, or add a control; reuse existing variants and retry placement.
- [ ] **Step 7:** Run both unit files, `npm run check`, and browser offline/reconnect/reload flows on local fixtures. Verify quota/storage failures retain in-memory recovery and display failure, never falsely claiming durable persistence. Checkpoint: `fix: preserve queued attempts across retries and account changes`.

### Task 5: Preserve active sessions and isolate accounts

**Files:** Create `src/lib/activeSession.ts`, `tests/unit/activeSession.test.ts`. Modify script/state wiring in `src/routes/+page.svelte`, `src/routes/quiz/+page.svelte`, `src/lib/components/ResultScreen.svelte`, `src/lib/components/Dashboard.svelte`, `src/routes/exams/+page.svelte`, `src/routes/submission/[id]/+page.svelte`, and `src/lib/components/AuthButton.svelte`. Extend the operations runbook with legacy recovery instructions.

**Interfaces:** `ActiveSessionV2` contains `{version: 2, owner: string, attemptId: string, questions: Question[], currentIndex: number, userAnswers: Record<number,string>, pendingAnswer: string|null, mode, category, level, elapsedSeconds: number, durationSeconds: number, profile: 'official'|'extended'|'custom', activeCategoryTab: string, updated_at: string}`. Mode/level use Task 4 unions. Define `parseActiveSession(raw: unknown, owner: string): ActiveSessionV2 | null`, `readLocalSession(owner: string): ActiveSessionV2 | null`, `writeLocalSession(session: ActiveSessionV2): void`, `loadActiveSession(owner: string): Promise<ActiveSessionV2|null>`, `pauseActiveSession(session: ActiveSessionV2): Promise<void>`, and `clearActiveSession(owner: string, attemptId: string): Promise<void>`. Guest ownership is `guest:<persistent-browser-UUID>`; authenticated ownership is `user:<auth-UUID>`.

- [ ] **Step 1:** Write tests asserting A's local session is invisible to B/guest; malformed indices/answers/types are rejected without deleting raw data; owner-protected legacy cloud data restores with original questions and legacy computed duration; unowned legacy local data is quarantined; a delayed delete cannot clear a newer attempt; and failed persistence retains the recoverable copy. Include a corrected-bank fixture with an older snapshot/key and assert it is not regraded.
- [ ] **Step 2:** Run `npx vitest run tests/unit/activeSession.test.ts`; record failing ownership, restoration, and duration cases.
- [ ] **Step 3:** Implement owner-scoped local keys `cse_active_session:v2:<owner>`. Cloud rows remain under existing user_id RLS and store V2 JSON. Recover a legacy cloud row only through its authenticated owner, assign/persist one attemptId, and retain its snapshot and `ceil(count*1.12)*60` legacy duration. Preserve unknown-owner legacy local raw data under a quarantine key; do not auto-adopt it on first login. Document manual recovery without silently dropping data.
- [ ] **Step 4:** Restore current category from the current question's group, using the existing tab labels, and retain pending/confirmed practice answers. Take owner-scoped local checkpoints after answer/navigation changes, debounced by 500ms, plus timer checkpoints at 5-second intervals. Explicit Save and Close flushes immediately, writes the cloud pause, and keeps existing paused-time behavior; teardown/visibility handlers perform synchronous local flush only. Catch checkpoint errors so a storage failure cannot crash answering. Save/Close and Discard failures use the existing confirmation/alert component with error text, keeping the current screen and recoverable copy; no new dialog component, button, or CSS. No per-answer cloud writes or new navigation warning.
- [ ] **Step 5:** Create the attempt ID at fresh quiz initialization and persist it in checkpoints. On submit/timeout, finalize completion once and enqueue the immutable payload before discarding the local recovery snapshot. Failed durable enqueue keeps the snapshot. Pass the same ID to ResultScreen so mount/Retry cannot create another result; Task 3 handles matching cloud cleanup. Terminate/discard checks returned Supabase errors and keeps local recovery when cloud cleanup fails.
- [ ] **Step 6:** Replace polling auth waits with cancellable initialization; reset/refetch Dashboard/exams/submission data after resolved identity changes and ignore stale fetch responses. Do not briefly treat an initializing signed-in account as a guest. Returning to Dashboard after a successful background drain refetches data without adding a new control.
- [ ] **Step 7:** Run the session/queue units and `npm run check`; browser-test save/close/resume, refresh checkpoint recovery, timeout, discard failure, logout/login A-to-B, and a direct history/submission reload. Confirm original snapshots, tab navigation, and paused durations survive. Checkpoint: `fix: restore owned quiz sessions without losing progress`.

### Task 6: Add official-format profiles and fix bounded selection

**Files:** Create `src/lib/examConfig.ts`, `src/lib/questionSelection.ts`, `tests/unit/examConfig.test.ts`, `tests/unit/questionSelection.test.ts`, `tests/unit/questionsApi.test.ts`, `tests/unit/quizLoad.test.ts`. Modify `src/routes/+page.svelte` option/configuration wiring only, `src/routes/quiz/+page.ts`, `src/routes/quiz/+page.svelte` timer/data wiring, and `src/routes/api/questions/+server.ts`. Create `src/lib/supabaseConfig.ts` and modify `src/lib/supabaseClient.ts` only to share the same public configuration resolution with request-scoped API clients.

**Interfaces:** Define `ExamProfile = 'official'|'extended'|'custom'`, `ExamConfig = {mode:'practice'|'mock',level:ExamLevel,profile:ExamProfile,count:number,durationSeconds:number,weighted:boolean}`, `resolveExamConfig(input:{mode:string,level:string,category:string,limit:string,profile?:string,realistic?:string}): ExamConfig` (invalid explicit official combinations throw a typed validation error), and `allocateQuotas(limit:number, weights:readonly number[]):number[]`. Define `selectQuestions(pool:readonly Question[], request:{count:number,weighted:boolean,level:ExamLevel,category:string}, progress:{seen:readonly string[],wrong:readonly string[]}, rng?:()=>number):Question[]`. `resolveSupabaseConfig(publicEnv:Record<string,string|undefined>): {url:string,key:string}` must produce the same project configuration on client and server; preserve the existing fallback until deployment environment values are verified, never quietly reroute users.

- [ ] **Step 1:** Write exact configuration/compatibility assertions:

```ts
expect(resolveExamConfig({mode:'mock',level:'professional',category:'',limit:'150',profile:'official'}).durationSeconds).toBe(11400);
expect(resolveExamConfig({mode:'mock',level:'subprofessional',category:'',limit:'145',profile:'official'}).durationSeconds).toBe(9600);
expect(resolveExamConfig({mode:'mock',level:'professional',category:'',limit:'170',realistic:'true'}).durationSeconds).toBe(11460);
expect(resolveExamConfig({mode:'mock',level:'subprofessional',category:'',limit:'165',realistic:'true'}).durationSeconds).toBe(11100);
expect(resolveExamConfig({mode:'practice',level:'professional',category:'',limit:'20'}).durationSeconds).toBe(0);
```

Also test invalid official count/category/mode rejection, persisted 170 remaining available, unchanged default 20 practice, and legacy URL normalization. For selection test every integer count 1-2000 with fixed RNG and assert length `min(count,eligiblePoolSize)`, unique IDs, level exclusion, and nonnegative quotas summing to count. Test limit 2, missing subcategories, category+legacy-realistic, wrong IDs absent from seen, and no eligible pool.
- [ ] **Step 2:** Run `npx vitest run tests/unit/examConfig.test.ts tests/unit/questionSelection.test.ts tests/unit/questionsApi.test.ts tests/unit/quizLoad.test.ts`; confirm the current quota/config/error behavior fails.
- [ ] **Step 3:** Implement largest-remainder allocation, deterministic tie-breaking in existing category order, and shortfall redistribution first within the broad group then across remaining eligible groups. Keep P weights 50/50/50/20 and subprofessional 50/50/45/20 as app-defined training ratios; derive official-sized quotas from these ratios without claiming they are CSC quotas. Use disjoint unseen/wrong/correct sets and deduplicate by question ID. Preserve returned question shape with answer keys.
- [ ] **Step 4:** Extend the existing dropdown, only in mixed mock mode, with `150 Questions (Official-format Mock)` for professional and `145 Questions (Official-format Mock)` for subprofessional. Relabel existing level-specific 170/165 as `Extended Mock`; retain custom/full count options, same control and CSS. Official selection appends `profile=official`; legacy count values and URLs remain supported. Normalize persisted selections to the available options, preserving valid 170.
- [ ] **Step 5:** Wire profile/count/duration into load and session V2. Practice remains untimed; resumed V2 or legacy snapshots use stored/upgraded legacy duration, not a freshly inferred profile. No EDQ form, personal-data fields, or scoring denominator inflation. For existing URLs without explicit profile retain legacy timing and weighting semantics.
- [ ] **Step 6:** Make the quiz route client-loaded (`export const ssr = false` in its page load module) so direct/reloaded personalized exams fetch with the browser's restored Supabase session. Obtain the session directly in load rather than waiting on a layout onMount that might not yet run. Create a per-request API Supabase client with persistence/refresh/url-detection disabled; use the authenticated identity/RLS, never trust a userId alone or reuse mutable server auth state. Guest requests still work. Align server/client configuration resolution; no logged secrets.
- [ ] **Step 7:** Validate API mode/profile/count inputs and build URLs with URLSearchParams. Preserve the existing 1-2000 count bound for custom requests, handle invalid/empty categories predictably, and return 400 for invalid official combinations. Assert `res.ok` and array/question shape in load; use the existing route/error behavior for failures instead of rendering an error object as questions. Preserve no-store headers and data contract.
- [ ] **Step 8:** Run the four unit files, full unit suite, `npm run check`, and `npm run build`. Browser-check both official options, both legacy options, practice confirmation, overview navigation, selection restore, and direct authenticated quiz reload against local users. Checkpoint: `fix: add official mock profiles and retain extended exams`.

### Task 7: Upgrade affected dependencies without changing the product

**Files:** Modify `package.json`, `package-lock.json`, and only narrowly necessary compatibility code in `svelte.config.js`, `vite.config.ts`, or existing Svelte imports. Record resolved versions/advisories in the operations runbook. No CSS/framework swap.

**Interfaces:** Preserve all existing route paths, public component behavior, auth/session contracts, and the RPC/queue/config contracts established above.

- [ ] **Step 1:** Record `npm ls --depth=0`, `npm audit --json`, engines, and the official upgrade/advisory documents. Inspect published peer versions with `npm view` before selecting exact compatible stable releases. DNS/audit failure is an unperformed check, not a clean result.
- [ ] **Step 2:** Upgrade SvelteKit to stable 3.x at least 3.0.0 and Vite 8.x at least 8.0.16, with compatible maintained Svelte 5/plugin/adapter and test-tool releases. Confirm transitive cookie/advisory resolution from the final lockfile. Use registry-generated lock updates; do not hand-edit integrity data or run `npm audit fix --force`.
- [ ] **Step 3:** Apply only compatibility changes required by the verified upgrade guide. Retain the existing adapter if compatible; if the actual host requires a different adapter, report that deployment dependency instead of guessing. If a fixed target is not published/compatible, preserve a reviewable branch state and report unresolved advisories with mitigations; do not call the upgrade complete.
- [ ] **Step 4:** Run `npm ci`, `npm test`, `npm run check`, `npm run build`, `npm audit --json`, `supabase test db`, and `npm run test:integration` again. Require a reproducible install and no unexplained regression; list residual advisories with actual applicability instead of hiding them. Checkpoint: `chore: update affected SvelteKit and Vite dependencies`.

### Task 8: Verify the integrated result and prepare a reviewable handoff

**Files:** Update this plan's checkboxes, `docs/content/question-review.json`, and `docs/operations/cse-database-upgrade.md`. Create `docs/operations/cse-verification.md` with commands, dates, results, and browser evidence. No product edits unless a verified regression from Tasks 1-7 requires a scoped repair.

**Interfaces:** Consume the completed tasks' contracts. Produce a source-ready change and a separate deployable SQL artifact/runbook; no production deployment in this task.

- [ ] **Step 1:** Run `npm test`, `node validate_questions.cjs`, `npm run check`, `npm run build`, `supabase test db`, and `npm run test:integration`. Record exact outcomes and unavailable checks. Confirm all 1,850 original IDs/counts remain; list editorial coverage separately from automated coverage.
- [ ] **Step 2:** Exercise the local browser matrix: guest and two signed-in users; practice/mocks; official 150/145 and extended 170/165; save/close/resume/discard; timeout; refreshed pending attempts; offline/reconnect; storage failure; duplicate retry; concurrent tabs; A-to-B logout/login; history and legacy submission review. Every route must remain reachable through the existing navigation. Use local test identities, never real OAuth/production writes as fixtures.
- [ ] **Step 3:** Compare before/after desktop and mobile screenshots on the same fixtures. Verify CSS, classes, button dimensions/placement, fonts, colors, and navigation are unchanged except the approved option/status text and corrected questions. Check console errors; do not claim physical-device verification from emulation. No accessibility redesign is added under this gate.
- [ ] **Step 4:** Review the entire diff for owner isolation, secrets, runtime dependency creep, data loss, and unrelated edits. Verify old question snapshots and scores still render unchanged, old paused exams keep their timing, and legacy 170 remains available. Report the unknown-owner legacy-session quarantine limitation explicitly.
- [ ] **Step 5:** Prepare production instructions only after tests: take backup, inspect live schema/policies/grants and migration history, reconcile bootstrap versions against actual deployed objects, apply only reviewed upgrade SQL, verify privacy and save behavior, then deploy dependent frontend. Do not run these steps against live Supabase or publish the app without explicit authorization. Retain the old frontend until the additive RPC exists; do not drop tables or purge pending storage in rollback.
- [ ] **Step 6:** For native execution, request one bounded independent GPT-6.1 Sol High review of the final diff and the spec; validate its findings yourself. If the user chooses subagent-driven execution, follow that workflow's per-task reviews instead. Summarize changes, verification, remaining limits, and actual commit/push/deployment status.

## Self-review of this plan

- Scope coverage: content register/verification in Tasks 1-2; profile/privacy/migrations in Task 3; queue/status in Task 4; recovery/auth compatibility in Task 5; official plus legacy options and API fixes in Task 6; dependency compatibility in Task 7; preservation/integration evidence in Task 8.
- Interface consistency: RPC returns UUID; queue send returns that UUID; all new exam/result/checkpoint flows share attemptId; ExamProfile values match ActiveSessionV2; SaveState is consumed by the existing indicator.
- Review focus coverage: every item is assigned to concrete failure tests above. No tests rely on a production database.
- Proportion: product bodies are left to implementation; exact values, identities, compatibility policies, boundaries, and acceptance checks are fixed here.
- Remaining external limits: live Supabase state/authorization, local database tooling availability, published dependency compatibility, editorial source reachability, and legacy ownerless data cannot be solved by pretending the repository contains that evidence.

## Handoff

Plan and spec are ready for user review; implementation is not started. Recommend native inline execution with one final independent review, because queue/session/profile tasks share interfaces and should be integrated serially. Subagent-driven execution remains available if the user prefers its per-task review cost.
