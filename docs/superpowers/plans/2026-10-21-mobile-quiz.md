# Mobile Quiz Readability Implementation Plan

> **For agentic workers:** Use `executing-plans` for inline implementation after the user approves this plan. Track the checkboxes below. This document authorizes no implementation, commit, push, or deployment by itself.

**Goal:** Give every mobile answer a uniform letter rail and reduce avoidable quiz scrolling while keeping the full question, choices, feedback, and controls readable.

**Architecture:** Make narrowly scoped component styles at `max-width: 600px`. Use a fixed two-column mobile choice grid so answer length and feedback cannot squeeze the letter rail; reduce surrounding whitespace before changing type. Keep desktop styles and quiz state logic intact.

**Tech stack:** Svelte 5.57.2, SvelteKit 2.70.3, component CSS, Bulma 1.0.4, Vite, existing Vitest suites. No new dependencies or persistent browser-test infrastructure.

**Spec:** The user's mobile screenshot and session brief are the design constraints. This is a bounded change; no separate spec document is needed. Screenshot inspected: `C:/Users/PC/AppData/Local/Temp/codex-clipboard-42fb122a-8418-45a9-bee8-12b3485f6f5b.png`. No browser session, app build, or runtime geometry measurement has been performed for this plan.

## Constraints and design direction

- Retain the current dark purple theme, DM Sans typography, navigation, question selection, practice feedback, scoring, timers, explanations, saved sessions, and resume behavior. Preserve any independently approved threshold changes; this plan does not change thresholds.
- Scope density changes to the active question screen. Do not redesign general buttons, change app-wide `.glass-card` rules, or alter desktop geometry. Any necessary exception requires concrete evidence and explicit justification before expanding scope.
- Do not truncate or line-clamp choices, hide explanations, force four long answers into one viewport, add nested scrolling within choices, reduce text to make everything fit, or introduce new panels.
- The user's latest targeted mobile readability authorization supersedes the earlier restriction on button sizing only for the rail and mobile density changes described here.
- Keep all changes at or below 600 CSS px, matching the existing QuestionCard and review breakpoint. Above 600px retain existing geometry, including phone landscape that exceeds this breakpoint. Validate the transition at 600/601px and existing 580/640px action/category breakpoints.
- Anti-Slop mode is `during` by session override. Reading this as an exam question screen for exam candidates, retaining the established purple visual language: ENERGY 1 / RHYTHM 1 / MOTION 1. The question remains the focal point; existing answer-state colors communicate state. No new color, decoration, animation, font, asset, or navigation is needed.
- Preserve `.gitignore`, which currently ignores `*.md`; this plan is a local ignored document unless the user later explicitly requests tracking it. Never change ignore rules to include it.

## Source-grounded diagnosis and file map

| File | Finding and intended responsibility |
| --- | --- |
| `src/lib/components/QuestionCard.svelte` | `.choice-btn` is flex; `.choice-letter` declares `width: 3.5rem` without disabling shrink, while `.choice-text` only declares `flex-grow: 1` and has an automatic minimum width. Long text and the additional practice `.status-icon` compete for inline space. A width alone is not a fixed rail. Add the mobile grid and compact card/header/choice spacing here. Preserve props, callbacks, disabled behavior, and `aria-pressed`. |
| `src/app.css` | Global `.glass-card` padding is `2rem`; no global mobile card override exists. Keep this file read-only. Override only QuestionCard's article locally, avoiding dashboard/modal changes. Existing colors, fonts, radii, borders, and motion stay. |
| `src/lib/components/ProgressBar.svelte` | Sole current consumer is `/quiz`. Wrapper contributes `1.5rem` top padding plus `2.5rem` bottom margin. Add mobile spacing and wrapping only; retain all count/score/timer calculations. |
| `src/routes/quiz/+page.svelte` | Container has `1rem` side gutters and `4rem` bottom padding; overview gap is `1.5rem`; actions add `2rem` top margin plus `1.5rem` top padding. Reduce these mobile gaps locally. Preserve all event handlers and the existing action order/stacking. |
| `src/lib/components/ResultScreen.svelte` | Review choices repeat the flex rail defect (`width: 2.75rem`, no shrink protection) with inline status labels. Apply the same mobile rail/text/status geometry only. Do not extend active-screen density changes into the overall results layout. |
| `src/routes/submission/[id]/+page.svelte` | Already sets `.choice-letter { flex-shrink: 0 }`; `.choice-status` also cannot shrink. This is not the same missing-shrink defect. Keep it read-only and regression-check long text/status. If actual browser evidence finds overflow here, report it and justify a separate scoped amendment before editing. |
| `src/lib/questions/general_info_constitution.json` | Question `7025` exactly matches the screenshot. Read-only source for the fixed measurement fixture. |

The screenshot shows the category label, header divider, question-to-answer space, and tall choices accumulating vertical space. It does not establish CSS-pixel dimensions or a before/after reduction, so no numerical scroll-saving claim is made here. Installed Svelte compiler CSS handling and Bulma reset were inspected: component-local selectors can own this change, and inherited border-box sizing must be considered when measuring rails.

## Chosen mobile values and tradeoff

Use the following values only under `@media (max-width: 600px)`; at a default 16px root, `2.75rem` is 44px. Use rem units so text enlargement can grow the interface.

| Area | Proposed mobile value | Reason |
| --- | --- | --- |
| Quiz container | `padding: 0 0.75rem 2rem` | Recover horizontal text room and remove excess trailing space. |
| QuestionCard article | `padding: 1rem` | Replace the inherited desktop `2rem` inset only on the active card. |
| Question header | retain column layout; `gap: 0.5rem`, `padding-bottom: 0.75rem`, `margin-bottom: 1rem` | Keep category and question count distinct with less empty space. |
| Category/question text | `min-width: 0; max-width: 100%; overflow-wrap: anywhere` where needed; preserve font sizes | Long category names and unbroken content must reflow. Keep question `1.25rem`, line-height `1.5`. |
| Question-to-choices | `.q-text { margin-bottom: 1.25rem }` | Reduce current `2rem` gap without compressing prose. |
| Choices | `gap: 0.5rem`; each button `min-height: 2.75rem` | Save repeated gaps while retaining a minimum touch target. Natural content height is unlimited. |
| Letter rail | two grid columns: `2.75rem minmax(0, 1fr)`; letter in column 1 spanning text/status rows, stretched vertically, `width: auto; min-width: 0` | The explicit first track makes A/B/C/D equal regardless of text length or state. No proportional shrinking. |
| Choice text | column 2, first row; `min-width: 0; padding: 0.75rem; overflow-wrap: anywhere`; active choice font remains `0.95rem`, explicit line-height `1.5` | Preserve current readable type while recovering padding width. Do not set a maximum height. |
| Practice status | column 2, second row; `padding: 0 0.75rem 0.625rem; min-width: 0; overflow-wrap: anywhere` | Correct/Wrong labels remain visible and cannot steal text width. No second-row gap when status is absent. |
| Progress wrapper/meta | wrapper top padding `0.75rem`, bottom margin `1.25rem`; meta bottom margin `0.5rem`, `flex-wrap: wrap`, gap `0.5rem` | Trim header whitespace; allow counts and timers to wrap at zoom. Do not hide them. |
| Overview/mixed bar | overview bottom margin `0.75rem`; mixed bar padding `0.75rem`, bottom margin `0.75rem`, gap `0.5rem` | Keep question selection available with tighter surroundings. Preserve category button dimensions; allow category names to wrap if they overflow (`white-space: normal; min-width: 0; overflow-wrap: anywhere`). |
| Quiz actions | top margin `1.25rem`, top padding `1rem`; retain existing internal gaps, button padding and order | Remove only empty space before actions. |
| Clear Selection | mobile `min-height: 2.75rem` | Avoid making this small existing control harder to tap in the compact layout. Preserve its text/padding and behavior. |

For ResultScreen's mobile review rows use the same two-column rail invariant and put `.choice-status` below the text, preserving its current mobile text size, padding, gaps, colors, and result-card spacing. No shared component extraction is necessary for this small fix.

Tradeoff: the fixed rail may reserve slightly more width than today's squeezed rail, and practice feedback on a separate line adds height after answering. Wider usable card content and reduced empty spacing address the baseline scrolling; full text, clear feedback, and reliable letter alignment take priority over fitting an entire question on one screen. A flex fix (`flex: 0 0 2.75rem`) alone would prevent rail shrink but retain inline status competition, so the two-column mobile grid is the chosen approach.

## Review focus

1. Unequal long answers and practice feedback must never change the four letter widths or answer-text start positions.
2. Long category names, multi-paragraph questions, explicit newlines, and a 120-character unbroken token must reflow without clipping or horizontal page scrolling.
3. Text enlarged to 200% must remain complete and operable; extra vertical scrolling is acceptable.
4. Correct, wrong, pending, selected, disabled, keyboard-focus, and touch-pressed states must remain distinguishable without changing geometry.
5. A phone rotated to landscape and a 1440px desktop must retain reachable controls and existing wider-screen layout.

## Task 1: Establish reproducible browser evidence

**Files:** Read `QuestionCard.svelte`, `ProgressBar.svelte`, `/quiz/+page.svelte`, `ResultScreen.svelte`, `/submission/[id]/+page.svelte`, `src/lib/activeSession.ts`, and the question 7025 bank entry. Record results in this plan; do not edit bank data or create production test seams.

- [ ] Inspect current worktree changes before starting. Preserve unrelated and independently approved threshold work. Start the existing local app using `npm run dev -- --host 127.0.0.1` with the project's configured environment; do not expose secrets.
- [ ] Use an isolated local guest browser profile/context. Create a valid version-2 guest session through the existing storage format (`cse_guest_active_session:v2`, owner/generation null), using real bank questions, total 20, question 7025 at index 10, unanswered practice state, and unchanged answer ordering. Reload `/quiz` to exercise the existing local reload restore path. Never seed or clear the user's real browser profile or production account. Confirm the visible question/choices equal the source before measuring.
- [ ] Before CSS edits, save screenshots and measurements at 320x800, 360x800, 390x844, 430x932 and desktop 1440x900. Wait for fonts and entry animations to settle. Record viewport size, root font, browser, question-card height, each rail width, first-answer top, last-answer bottom, actions bottom, `document.scrollingElement.scrollHeight`, and `max(0, scrollHeight - clientHeight)`. Keep mode, content, progress/header state, viewport height, zoom, and browser identical for the after measurement.
- [ ] Demonstrate baseline failure using rendered geometry: rail width spread exceeds a 1 CSS-pixel tolerance or falls short of the intended fixed track under long text/state. Capture actual results, even if a particular fixture does not reproduce the screenshot's variation; use deliberately unequal short/long choices in the isolated fixture to expose the mechanism. Do not invent a failing observation.

## Task 2: Apply the active-screen mobile layout

**Modify:** `src/lib/components/QuestionCard.svelte`, `src/lib/components/ProgressBar.svelte`, `src/routes/quiz/+page.svelte` styles only. **Interfaces:** All existing props, markup semantics, selection/state handlers, timers, persistence, and callbacks stay intact.

- [ ] Implement the mobile values above using component-local selectors; give the active article a local class only if needed for an unambiguous override. Keep all wider-screen base values intact.
- [ ] Implement grid placement for the existing letter, choice text, and status spans; no fixed row heights. Keep the rail continuous for the entire card height, including feedback. Prevent text overflow through reflow, not clipping. Keep the decorative rounded choice border without clipping content.
- [ ] Retain visible keyboard focus. If the existing outline is insufficient or clipped, add a mobile `.choice-btn:focus-visible` outline of `2px solid var(--cse-primary-light)` with `2px` offset, without suppressing the default focus globally. Verify the outline is visible on all relevant surfaces and does not affect dimensions.
- [ ] In the isolated browser fixture assert, across unanswered, pending, exam-selected, correct/wrong feedback and disabled states: `max(railWidths) - min(railWidths) <= 1px`; every rail equals `2.75 * computed root font size` within 1px; all choice-text left edges align within 1px; each choice's bounding height and width are at least 44 CSS px at default zoom; all choice text/status bounding boxes stay inside their card. Use bounding rectangles and text visibility checks, not source/CSS snapshots.
- [ ] Verify keyboard Tab plus Enter/Space selection, visible focus, full-card tapping, Clear Selection, Submit Answer and correct/wrong explanations, Previous/Next, question overview and category selection, Save and Close/resume, and mock countdown. Ensure score, answer order, and resume selection match expected existing behavior. Do not submit attempts to a production account as a layout test.

## Task 3: Cover the actual review duplicate

**Modify:** `src/lib/components/ResultScreen.svelte` mobile choice geometry only. **Read-only regression target:** `src/routes/submission/[id]/+page.svelte`.

- [ ] Apply the same 2.75rem fixed grid rail to ResultScreen review choices and let its existing Correct Answer/Your Answer labels occupy column 2 below the answer. Do not change summary layout, scoring, benchmark text, or explanation visibility.
- [ ] Use correct, incorrect, and unanswered review cases with short/long choices; repeat equal-rail, aligned-text and contained-full-text assertions. Open a local/test submission review and confirm its existing nonshrinking rail works. Record any submission-only overflow separately rather than silently broadening this plan.

## Task 4: Validate density, accessibility, regression scope, and handoff

**Files:** Record measured results and actual check outcomes in this plan. No additional process documents required.

- [ ] Repeat Task 1's exact fixture/viewport measurements after the change. At each mobile width require lower total document scroll height and lower question-card height than its own baseline, with complete identical text. Record the measured deltas, not an estimated percentage. If a browser or fixture does not improve, diagnose wrapping and spacing rather than hiding content or shrinking type. At 1440x900 require unchanged card/rail/action geometry within 1px after fonts/animations settle.
- [ ] At widths 320/360/390/430 and at 600/601/640/768/1440, check `scrollWidth <= clientWidth + 1` for the page and no clipped text/status. Include a long category, long passage, explicit line breaks, underline/blank markup, unequal choice lengths, 120-character unbroken token, and 200% text enlargement. Preserve intended line breaks if the real bank uses them; do not change question rendering as an incidental layout fix. Text enlargement is a separate case from screenshot viewport resizing.
- [ ] Inspect portrait and landscape (including 844x390 where wider styles apply), low-time timer, wrapped progress metadata, feedback and explanations, and the last action at the page bottom. Native iOS Safari manual gate: test a real iPhone in portrait/landscape with Safari chrome expanded/collapsed, enlarged text, taps, and zoom; ensure safe areas do not cover choices/actions. Browser emulation is not a physical-device pass. If no device is available, explicitly report this gate as pending and do not claim iOS validation.
- [ ] Check changed interactive boundaries, text/status and focus contrast against their composited backgrounds; retain existing palette unless a measured changed-area failure requires a narrowly justified accessible adjustment. Confirm keyboard navigation and at least 44x44px touch areas for choices, Clear Selection, overview and active quiz actions. Do not redesign unrelated controls to address findings outside scope.
- [ ] Run `npm run check`, `npm run build`, and `npm test`. Require successful exits; distinguish pre-existing failures with evidence. Use browser assertions above for layout, not unit tests that merely inspect CSS strings. Do not install a browser dependency to satisfy the plan.
- [ ] Review the final diff for mobile-only selector scope, unchanged desktop geometry, unchanged logic/data/dependencies, no `.gitignore` changes, no accidental threshold edits, and preserved unrelated work. Update the verification notes below with actual automated/browser/manual outcomes.
- [ ] Only after plan approval and verified implementation, create a scoped checkpoint commit and push if the session's explicit implementation/Git authorization covers those actions. Stage only intended source files. Recheck authorization at execution; plan approval alone is not push permission. Do not deploy. Do not force-add this ignored Markdown plan unless explicitly requested.

## Verification record

Planning evidence: screenshot viewed; source and installed Svelte/Bulma behavior inspected. No application source changed for this plan. Runtime, browser, build, contrast, and physical iOS checks are pending implementation.

| Fixed fixture 7025 | Before scroll/card height | After scroll/card height | Delta | Equal rails/full text | Status |
| --- | --- | --- | --- | --- | --- |
| 320x800 | Not measured | Not measured | Not measured | Not checked | Pending |
| 360x800 | Not measured | Not measured | Not measured | Not checked | Pending |
| 390x844 | Not measured | Not measured | Not measured | Not checked | Pending |
| 430x932 | Not measured | Not measured | Not measured | Not checked | Pending |
| 1440x900 | Not measured | Not measured | Must preserve geometry | Not checked | Pending |

Plan review: scope matches the supplied brief; each review-focus case has a browser check above; values and ownership are explicit. Anti-Slop planning gate PASS for preserved direction, justified spacing/rail decisions, no new assets/content/features, and explicit verification gates. UI delivery gate remains pending because no implementation or runtime verification is authorized in this planning task.
