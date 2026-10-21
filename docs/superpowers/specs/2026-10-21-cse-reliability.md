# CSE corrections and reliability scope

Date: 2026-10-21, Asia/Taipei.

Status: consolidated from the user's approved priorities and subsequent corrections; implementation has not started. Read this document together with the implementation plan before changing code.

## Outcome and constraints

Make the existing reviewer more accurate and reliable for its current approximately 2-10 users, with useful foundations for later public access. Preserve the approved product experience.

- Preserve the existing appearance, CSS, button sizes, spacing, fonts, colors, animations, navigation, routes, and control placement.
- Preserve guest access, Google sign-in, practice feedback, mixed/category review, overview navigation, manual Save and Close, resume/discard, submission review, history, and analytics.
- Retain client-side grading, answer keys in the client, and existing practice-mode rules.
- Allow only question corrections, accurate text in the existing save indicator/error dialogs, and the approved exam-option labels/configuration to change visible content. Error feedback reuses existing dialog controls and styling.
- Preserve all existing question IDs, categories, per-file counts, and the 1,850-question total; repair defective questions in place.
- Preserve historical scores, answer snapshots, and paused-exam question snapshots. Never silently regrade old attempts using the corrected bank.
- No production database writes, deployment, commit, or push is authorized by this planning request.
- Do not turn this work into a redesign, new dashboard, server-side grading system, realtime rewrite, or infrastructure scaling project.

## 1. Question corrections

Use internet references proactively. Prefer CSC publications for scope/format, official legislation for law, ASEAN for membership, and authoritative dictionaries/grammar references for language. Verify numerical answers independently; enumerate small constraint problems instead of accepting an explanation because it sounds plausible.

The CSC warns that it does not publish/endorse CSE review materials. The request to refer to actual CSE questions means matching verified exam scope and rigor; do not label third-party or newly repaired questions as authentic past examination questions without verified provenance. This does not block correcting the existing bank.

Keep a non-runtime editorial ledger at `docs/content/question-review.json`, keyed by question ID, with `file`, `status`, `reviewed_at`, `method`, `source_urls`, and `reason`. Status is `corrected`, `verified`, or `needs_review`; an unreviewed item must not be reported as verified. Arithmetic/permutation evidence may use an empty `source_urls` array and an explicit calculation. For reviewed legal/current-event items, record a primary source and the verification date.

All 1,850 items receive structural checks. Correct the confirmed register below first, then review the remaining records by file for mathematical correctness, ambiguity, and explanation/key consistency. Final delivery reports the actual editorial coverage and any unresolved questions, rather than claiming the whole bank is certified by structural tests.

### Confirmed correction register

| File under src/lib/questions | IDs | Required correction |
| --- | --- | --- |
| numerical_age_problems.json | 9024 | Supply Rita's current age as 16; the requested time becomes 16 years. Adjust one choice, key, and derivation together. |
| numerical_age_problems.json | 9043 | Replace the misleading recently born baby wording with a fifth family member; the new member's age is 6, from 90 minus 84. Include 6 as the unique answer. |
| numerical_age_problems.json | 9052 | Change the parents' present average to 30 and the average at the child's birth to 18; the child's age is 3. Explain 60 minus 2c equals 54. |
| numerical_work_problems.json | 14008 | Keep the original work figures; answer 10 2/3 days from 960 divided by 90. Include the exact fraction. |
| numerical_work_problems.json | 14053 | Change the key to 30 days and correct the arithmetic. |
| numerical_work_problems.json | 14055 | Include and key the exact answer 1 2/3 days; remove unsupported rounding to 1.6. |
| numerical_number_series.json | 11032 | Include and key 481; explain multiplying by 3 then adding successive odd numbers. |
| numerical_number_series.json | 11042 | Keep 294; correct the rule to n times (n+1) squared, with n=6 for the next term. |
| analytical_assumptions.json | 2024 | Add that E sits immediately left of A; key E and retain consistent facing-center directions throughout the solution. |
| analytical_assumptions.json | 2033 | Change the A/B condition to cannot both be chosen. C,E,F plus either A or B is feasible; E and F is the uniquely required pair among the choices. |
| analytical_assumptions.json | 2044 | Key Box 3, with bottom-to-top order 1,4,3,2,5. |
| analytical_assumptions.json | 2051 | Change E's constraint to adjacent to D; verify the unique circle and keyed E. |
| analytical_assumptions.json | 2063 | Require Module 1 immediately after Module 3; Module 4 then must be last. |
| analytical_assumptions.json | 2071 | State explicitly that B1 is left of B2; the middle is then B3. |
| analytical_assumptions.json | 2078 | State that an applicant is hired only if both stages are passed; the failed interview then entails not hired. |
| analytical_data_interpretation.json | 3025 | Set Center C's passers to 120 consistently in stem and explanation; C uniquely has 40 percent. |
| clerical_filing.json | 5010 | Under the explicitly stated Saint-expansion convention, include and key 1-2-4-3. |
| clerical_filing.json | 5017 | Key D-C-B-A. |
| clerical_filing.json | 5022 | Explicitly state that digits are indexed as spelled-out words for this question; filing 3M under T is then consistent. |
| clerical_filing.json | 5024 | Key St. Martin's Clinic as second under the same Saint convention. |
| clerical_filing.json | 5033 | State initials-before-full-names indexing; key 4-2-1-3. |
| clerical_filing.json | 5037 | State letter-by-letter indexing ignoring spaces; include and key 1-4-3-2. |
| analytical_logic.json | 4001,4002,4003,4004,4019,4021 | Keep Only conclusion II follows; fix the explanation's references to the true/false conclusions. |
| verbal_balarila_filipino.json | 20101 | Use Tumakbo ang bata ___ mabilis, keyed nang. |
| verbal_balarila_filipino.json | 20107 | Ask specifically for karaniwang ayos, with predicate before subject. |
| verbal_balarila_filipino.json | 20125 | Ask specifically for a prohibition, keyed Huwag kang tumakbo sa koridor. |
| verbal_balarila_filipino.json | 20141,20143 | Replace the second valid distractor with an objectively incorrect pronoun/location-adverb construction; verify a single correct choice. |
| verbal_correct_usage.json | 15079 | Specify that the relative clause is nonessential additional information about the speaker's only brother. |
| verbal_correct_usage.json | 15085 | Ask specifically for the construction placing the preposition before its objective-case interrogative pronoun. |
| verbal_correct_usage.json | 15099 | Replace angry at me as a distractor; both at and with can refer to a person. |
| verbal_grammar.json | 16087 | Ask specifically for future perfect continuous rather than claiming future perfect is ungrammatical. |
| general_info_current_events.json | 8056 | Include/key 11 ASEAN members, incorporating Timor-Leste's 2025-10-26 admission; date the factual claim. |
| general_info_current_events.json | 8077 | Use the actual short title Food Safety Act of 2013 for RA 10611. |
| general_info_constitution.json | 7009 | Ask for the constitutional body, not a Constitutional Commission, when keying CHR. |
| general_info_constitution.json | 7021 | Cite Article IX-B Section 3. |
| general_info_constitution.json | 7043 | Include/key the relevant former-office professional-practice restriction; verify the exact scope against RA 6713 Section 7(b). |
| general_info_constitution.json | 7100 | Cite Article VII Section 7. |
| general_info_constitution.json | 7107 | Cite RA 6713 Section 4(d); correct its maintenance-script source too. |

Fix the obsolete fixed-50 count rule in `validate_questions.cjs`; preserve the actual 50/75/100 per-file baseline. Duplicate IDs must cause a nonzero exit. Repair the double Roman-label swap in `fix_logic_bias.cjs` and make `scripts/add_10_new_gen_info.cjs` idempotent so reruns cannot reintroduce defects.

Do not run the mutation scripts on the real bank as a shortcut. Edit source JSON directly; test script behavior in temporary fixtures. Runtime answer-choice shuffling is deferred because it is a separate behavior change.

## 2. Saving, database privacy, and recovery

Keep the existing Supabase model. Add a transactionally safe save RPC and a small durable browser queue, with no new service or new product screen.

- One attempt receives one UUID when its quiz starts. Save/retry/reload reuse it. New attempts also retain their original completion timestamp.
- Save the completed attempt and merge its seen/wrong progress in one Postgres transaction, serialized per user. Retry of an existing UUID must not create another row, rewrite the snapshot, or reapply progress.
- Use SECURITY INVOKER, explicit `auth.uid()` ownership validation, restricted function execution grants, and existing RLS. Keep client-computed scores; validate their bounds and JSON shape rather than treating them as trusted examination results.
- Use native IndexedDB transactions for pending attempts. It prevents a completed drain or another tab from overwriting newly enqueued records, unlike rewriting one localStorage array. No new runtime package is needed.
- Migrate valid legacy pending records, which already include user_id, without deleting the source until the destination transaction commits. Assign deterministic stable IDs to legacy entries. Never remove existing database rows to guess whether an old queue item was already submitted.
- Drain only the signed-in owner's work after auth initialization, login, and reconnect. Clear the in-memory account view on logout; retain that owner's durable unsent work for their next login.
- The existing status area distinguishes saving, queued, confirmed account save, local guest save, and failure. Do not add controls, change CSS, or display account success before confirmation.
- Active sessions use versioned owner-scoped storage. Validate snapshots before restoration and restore category navigation from the current question.
- Preserve manual pause semantics: the timer does not run while explicitly saved/closed. Store each exam's duration so old sessions do not adopt new profile timing.
- Local answer/navigation checkpoints make accidental reload recoverable through the existing Resume flow. Explicit Save and Close remains the only normal cloud pause operation.
- A failed save must not clear the only recoverable copy. A delayed cleanup must not delete a different, newer active exam.
- Unknown-owner legacy local active-session data is retained in a quarantine backup, never assigned automatically to the next account or guest. Existing owner-protected cloud sessions remain resumable and are upgraded on restore. Report this compatibility limit clearly; ownerless data cannot safely be attributed from the old payload alone.
- Profile email/name/avatar rows are readable only by their owner; no UI code currently requires public profile reads. Verify actual deployed policies/grants separately from repository SQL.
- Consolidate reproducible local migrations, preserve the already-existing migration, and add an explicit upgrade path for an existing manually initialized database. Do not replay bootstrap SQL blindly against production.
- Add user_progress ON DELETE CASCADE; protect new attempts with value/shape constraints without rewriting historical invalid rows.

## 3. Official-format and retained Extended Mock

Use the official CSC 2026 counts and durations. EDQ is a personal-information questionnaire; do not collect new EDQ personal data or include it in scored knowledge questions.

| Option | Level | Scored questions | Minutes | Selection behavior |
| --- | --- | ---: | ---: | --- |
| Official-format Mock | professional | 150 | 190 | Mixed supported CSE categories |
| Official-format Mock | subprofessional | 145 | 160 | Mixed supported CSE categories |
| Extended Mock | professional | 170 | 191 | Preserve the existing 50/50/50/20 training mix |
| Extended Mock | subprofessional | 165 | 185 | Preserve the existing 50/50/45/20 training mix |
| Existing custom mock | either | Existing count choices | ceil(count times 1.12) | Existing category/mixed behavior |
| Practice | either | Existing count choices | Untimed | Existing confirmation and feedback behavior |

The user explicitly retained professional 170. Preserve existing subprofessional 165 too because no removal was requested. Keep both in the same existing dropdown. Default remains 20-question practice.

Official-format means the verified count, duration, and coverage only; the CSC source does not establish the app's per-category quotas. Retain the existing relative training weights for allocation and describe them as app-defined in code/docs. Do not claim CSC endorsement or authentic past questions.

Add `profile=official` for the new mock option. Existing URLs without this parameter, including `realistic=true&limit=170` and `realistic=true&limit=165`, retain legacy behavior. New official requests require mock mode, the appropriate count, and mixed category. Persist profile and duration in new snapshots; absence means legacy/custom behavior.

Use nonnegative largest-remainder quotas and redistribute shortfalls among eligible questions. Never exceed the requested count, repeat a question, or mix forbidden-level categories. Return the available pool size when a custom request exceeds it. In particular, `realistic=true&limit=2` returns 2, not 201. Preserve unseen, wrong, then correct priority using disjoint sets.

Validate fetch status/shape, restored selections, and API inputs. Personalized selection must use the requesting user's session, including direct/reloaded quiz visits; never use a shared server auth singleton for user-specific reads.

## 4. Dependency compatibility and delivery

Update the locked affected framework/tool versions after verifying the published releases and peer dependencies. Targets: SvelteKit stable 3.x at least 3.0.0 for the recorded SSRF/Windows-preview fixes, Vite 8.x at least 8.0.16, compatible maintained Svelte 5.x/plugin/adapter versions. Do not silently upgrade to an unreleased package or leave a known exposure marked fixed. If a fixed compatible release is unavailable, document the blocker and applicable temporary mitigations.

Retain Bulma, lucide-svelte, and the existing adapter choice unless compatibility requires a narrowly justified change. Introduce only development test dependencies, plus native browser/database APIs; no additional runtime dependency is planned.

Test with local Supabase fixtures, offline/reconnect, two users, concurrent tabs, legacy storage, and current routes. Capture before/after desktop/mobile screenshots to confirm unchanged geometry. A public launch is a separate step: this plan does not authorize deployment or certify live configuration.

## Deferred work

UI/accessibility redesign, button-size/contrast/theme changes, marketing copy, runtime choice shuffling, a real spaced-repetition scheduler, leaderboard integrity, server-side grading, pagination/analytics redesign, new account-deletion UI, large-scale infrastructure, and unrelated cleanup are outside this batch. Unsafe HTML rendering from the broader audit is tracked separately; this batch does not claim to resolve it.

## Sources checked during planning

- [CSC 2026 advisory, page 5: counts, EDQ, durations](https://csc.gov.ph/phocadownload/userupload/erpo/advisories/2026/ExamAdvisory_2026_02_School%20Assignment%20Impt%20Reminders%20for%2008%20March%202026%20CSE-PPT%20Sgd.pdf)
- [CSC warning about purported actual-exam reviewers](https://www.csc.gov.ph/csc-warns-public-against-civil-service-reviewers-review-centers)
- [ASEAN: Timor-Leste admission](https://asean.org/forging-a-new-era-timor-leste-admitted-into-asean/)
- [Official Gazette: RA 10611](https://officialgazette.gov.ph/2013/08/23/republic-act-no-10611)
- [Senate: RA 6713](https://issuances-library.senate.gov.ph/legislative%2Bissuances/Republic%20Act%20No.%206713)
- [Supreme Court: Constitution](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/3/353)
- [Cambridge: angry at/with](https://dictionary.cambridge.org/us/dictionary/english/angry)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions](https://supabase.com/docs/guides/database/functions)
- [SvelteKit ReDoS advisory](https://github.com/sveltejs/kit/security/advisories/GHSA-29g2-3rmr-qm68), [Windows preview advisory](https://github.com/sveltejs/kit/security/advisories/GHSA-xgrj-p7pg-6vm3), [SSRF advisory](https://github.com/sveltejs/kit/security/advisories/GHSA-prjg-x2qj-wj3g)
- [Vite Windows filesystem advisory](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff), [Vitest guide](https://vitest.dev/guide/)
