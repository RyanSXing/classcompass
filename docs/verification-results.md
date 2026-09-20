# Verification results

Checks performed on September 19–20, 2026. All work, student identities and handwriting images used in these checks are fictional. Prepared AI results and live provider checks are reported separately.

## Simpler labels, chart colors and clear chat

Student avatars and their image assets are removed; written student names identify the roster, charts and evidence. The teacher display name is **Ms. Verity**. Short labels such as **Actions**, **Understanding**, **Progress**, **Evidence** and **Objectives** replace sentence-like section titles.

The charts use teal for independence, amber for developing understanding and coral for support needs. The progress chart now includes a dashed support series alongside the solid independence series. Both preserve evidence gaps and dated counts; no understanding percentage or new score is inferred.

- **Clear chat:** the authenticated, same-origin DELETE route removes only chat turns and pending chat requests. Goals, briefings, plans and student work remain. Server coverage prevents an older response saving after clear; browser coverage checks empty history after reload, preserved goals, fresh questions, composer focus and a delayed pre-clear read arriving afterward. Workspace refreshes ignore superseded responses.
- **Browser checks:** all 30 scenarios passed across the initial run and a 15-scenario targeted rerun after updating selectors for the shorter headings. Chart/date selection, exact evidence links, missing-data gaps, name-only roster, keyboard use, 390/768-pixel layouts, uploads and saved lessons are covered. The initial failures were an old heading expectation and goals selectors that matched both a section and its textarea.
- **Other checks:** 289 unit tests passed; the final 70 assistant/API tests were checked again after preserving saved briefings in the clear test. ESLint and authored-fixture validation passed. Desktop charts and the assistant header were visually inspected against the running application.

Browser mutations used the isolated localhost test classroom on port 3001. No live model call was needed for verification.

## Figma-style charts and two teaching priorities

The overview now leads with two supported teaching actions, followed by student-stage bars, a skill radar and an independent-work trend. Detailed student work opens on selection. The graphs use the existing stage rules and dated evidence; no mastery percentage was added.

- **Teaching priorities:** focused tests cover current versus stale AI output, navigation-only suggestions, original multi-step instructions, duplicate AI actions, separate student groups and per-student timing. The current fixture groups Devon's numerator check separately from Casey and Harper's unfinished work. Each card keeps its own AI/sample/evidence provenance.
- **Chart interactions:** targeted browser checks cover priority order, synchronized date/skill selection, exact evidence revisions, keyboard use and 390/768-pixel layouts. An all-missing skill breaks both the radar polygon and the trend line. Historical dates do not use later assignments. The first new comparison assertion used the modified teacher classroom's count instead of the untouched fixture's count; the fixture was independently checked and the test corrected.
- **Regression checks:** 13 targeted browser scenarios passed, including uploads, review, assistant replies and saved lesson versions. The full unit suite passed before the final two prioritization cases were added; all six final priority cases passed. Production compilation and the artifact guard passed with 39 browser assets and 17 server traces checked. ESLint and TypeScript passed.

No saved teacher work was changed by these checks, and no new live model request was needed for this presentation update.

## Notebook workspace and teacher account

The [notebook redesign](notebook-redesign.md) adds the cream paper shell, original compass mark, eight generated student portraits, a dated lesson library, and a teacher sign-in boundary. The previous version is preserved on GitHub as `before-notebook-redesign-2026-09-20` at `eb631b3e74c4fddf0724835733792b4993a626a2`.

- **Account and saved work:** the requested teacher account was provisioned privately. A separate local backup was retained before transferring the existing eight-student, five-assignment classroom. All 80 original/normalized evidence files passed upload/readback hash checks, and the complete saved state matched after ownership transfer. The 40 submissions, 49 reading reviews, 18 observations, six lesson versions and existing assistant history were retained.
- **Connected access checks:** unsigned pages redirect to sign-in; unsigned classroom and evidence requests return 401. Sign-in, private evidence retrieval and local-session logout passed through the running app. Sample load, analyze and reset requests return 403 in the teacher workspace, and the saved state stayed unchanged during those checks. Normal browser sign-in returned to the requested lesson page; sign-out returned to login.
- **Automated checks:** the final unit run passed 282 tests across 27 files, including session-cookie refresh checks. ESLint, TypeScript and 674 authored-specification assertions passed. The first 27-scenario browser run passed 26 scenarios; the new roster check used a textbox locator for a searchbox. After correcting that locator, both new notebook scenarios passed, including all eight images loading and student search/navigation at 390 pixels.
- **Build and presentation:** production compilation passed. The artifact guard checked 38 browser assets and 17 server traces for private transcripts and local credentials/data. Student portraits, lesson selection, assistant presentation and sign-in were visually inspected; the desktop lesson library fits within the viewport.

This revision does not repeat the live model or handwriting evaluation. Historical sample replies remain labeled as sample replies; connecting the account does not reclassify prior AI results. Credentials, transfer scripts and private verification reports are excluded from Git.

## Visual understanding revision

The [visual understanding plan](visual-understanding-plan.md) is implemented. The overview leads with skill stages, class distribution bars, a student-by-date map and individual stage charts. Exact work and teaching checks sit behind each point. Student pages display their date cutoff. Lesson plans use a proportional timeline and Do / Ask / Check cards; AI activities show time, steps and what to look for. The purple/aqua palette is retained.

- **Domain and server checks:** 266 tests across 24 files passed. New coverage verifies independent working versus help, answer-only and missing evidence, task comparability, exact revisions, historical cutoffs and skill-specific arithmetic slips. A teacher-verified contradiction cannot establish independence or be reused as earlier supporting evidence. Assistant context contains the same derived stages and linked work as the charts.
- **Teacher workflows:** the 25-scenario Chromium suite covers the existing classroom workflow plus skill/date selection, exact evidence links, missing-evidence gaps, historical chart cutoffs, mobile layouts, the lesson timeline and preserved custom instructions. The first run exposed a collapsing result filter and a stage-label locator issue; both were fixed and the affected scenarios passed. The final visual/chart scenarios also passed without retries.
- **Presentation and build:** ESLint, TypeScript, 670 authored-specification assertions and 89 local links passed. Production compilation and the artifact guard passed with 34 browser assets and 16 server traces checked. Letter and A4 lesson prints rendered as five pages with full teaching content; desktop and 390px layouts were inspected.
- **Live AI check:** a normal-UI DeepSeek briefing saved and was compared with its visible sources. It keeps the saved Oct 1 lesson, checks Devon's numerator addition, asks Casey and Harper about unfinished work, and leaves the other students on the saved practice lanes. It correctly distinguishes Gray's earlier unknown help from later recorded independence. Action cards include minutes, short steps and a success check.

The live check also exposed an earlier false claim that Harper had two unfinished Sep 30 answers. That version remains stale history. A narrow validator now rejects explicit named-student unfinished-work totals that contradict the selected or named assignment; tests cover rejecting the false count, allowing the accurate count and preserving dates/fractions during the existing single correction pass. Earlier malformed/rejected drafts were not saved. This check does not prove arbitrary model prose correct.

Understanding stages are derived from the shown methods and recorded help; they are not a validated mastery scale. Handwriting extraction and Supabase isolation were unchanged and were not retested in this revision. No external teacher validated the new views.

## Learning insights revision

The [implementation plan](insight-first-plan.md) is complete: the default overview shows the next lesson decision, dated learning trends and priority student follow-ups. Raw results are available under **Explore the evidence**. The original purple/aqua design is retained.

- **Browser workflows:** all 19 Chromium scenarios passed without retries. New coverage loads all five assignments, inspects dated learning evidence, corrects a reading, opens and closes detailed analytics, respects an earlier assignment's date boundary, and saves selected lesson changes after generating multiple drafts. Returning to the overview opens the saved lesson without resurfacing an old draft. Existing upload, review, assistant, print-view, mobile and keyboard workflows remain covered.
- **Domain and server checks:** 240 tests across 22 files passed. Learning tests separate independence from unknown help, compare appropriate task conditions, keep blank and flagged work out of success claims, preserve exact support snapshots and prioritize unfinished or arithmetic checks before extension. A changed denominator after otherwise valid renaming cannot be mislabeled as a numerator-only slip.
- **Static and build checks:** ESLint, TypeScript, 667 authored-specification assertions, 86 local links and the production build passed. The artifact guard inspected 34 browser assets and 16 server traces for private reference transcripts and runtime data.

The isolated live-text checks used newly created fictional classroom state. In the initial compact-context check, prompt usage fell from roughly 178,000–193,000 tokens to 28,551–29,644 per call while retaining all literal answers and saved plan instructions. A Casey progress reply passed after one correction and distinguished dated supported work, independent work and an unfinished answer. A captured briefing incorrectly called unverified work “reviewed”; replay under the final status guard rejects it. The private reports retain that failure. Citation checks establish source identity and dated association, not sentence-level instructional accuracy. A subsequent manual UI check caught a briefing that described correctly worked Casey answers as denominator-addition errors despite citing those answers. That briefing is stale history. The current revision adds readable focused facts, dates every teaching note, rejects leaked source aliases and tests this specific contradiction. It also distinguishes a named student’s reduced-help trend from an unsupported class-wide claim. The final fictional fixture context measures about 125.5 KB, compared with about 590 KB before deduplication; readable facts and source labels were added after the earlier token measurements. These guards do not claim general semantic proof.

The final normal-UI live briefing saved after one bounded correction pass. Manual inspection confirmed Casey's supported-to-independent comparison, Gray's previously unknown help, Devon's numerator slip, and Casey/Harper's unfinished answers against the linked work. It recommended individual checks while the class continues and retained the fixed October 2 assessment. The primary summary, dated sources and navigation actions were inspected in the teacher overview. Live briefings now permit up to 24 checked citations so comparisons and follow-ups retain their evidence; chat remains capped at 12. Boundary tests cover both limits. Generated activity suggestions still require teacher review before becoming lesson changes.

Handwriting, Supabase isolation and full vision-to-plan checks were not repeated for this presentation/context revision; their last tested results remain below. No external teacher validated these outputs.

## Teacher workflow audit revision

Final checks: 181 tests across 21 files; 16 Chromium workflow scenarios without retries; 665 authored-specification assertions and 84 local links; ESLint, TypeScript and production build passed. The artifact guard checked 33 browser assets and 16 server traces.

The [teacher workflow audit](teacher-workflow-audit.md) records the concrete failures reproduced after the earlier revision, their fixes, and the expanded browser coverage. A fresh eight-image direct DeepSeek run now completed vision → analysis → simulated review → proposal in ten calls: 32/32 final-answer readings and parser classifications matched the authored work, eight findings passed validation, and three changes preserved the 45-minute lesson and recorded support. The older unsuccessful all-live run below remains a historical failure; it has not been overwritten.

Live roster and practical-teaching questions also passed on fresh fictional state. Invalid drafts receive at most one targeted correction, followed by the same validation; provider failures do not become prepared results. These checks establish the tested workflows, not a guarantee that every future model interpretation is right.

## AI teaching workspace revision

The original purple/aqua palette is retained. The new Overview has an AI brief with cited next actions, three analytics views and a comparison chooser. Lessons are complete teacher documents, and the assistant saves goals and conversation history.

| Check | Result and scope |
| --- | --- |
| Static and deterministic checks | 663 authored-specification assertions, ESLint, TypeScript and 163 tests across 19 files passed. Coverage includes direct-provider request formats, assistant persistence and citations, concurrency, historical evidence, narrow answer-label parsing, insight cohorts and complete saved lesson guides. |
| Teacher browser workflow | Eight Chromium scenarios passed without retries. New coverage includes saved goals and follow-up chat, exact source links, eight-student/five-assignment matrix, question patterns, generated briefs and staleness, complete lesson guides, exact historical versions, concurrent goal edits and interrupted-question recovery. Nine routes fit 390px; keyboard navigation remains usable. |
| Connected application | Fourteen real Supabase HTTP checks passed, including assistant goals, conversation, exact source revisions, briefing persistence, duplicate-request reuse and logout denial. Existing lessons and student evidence remained unchanged. These checks use explicit sample AI. |
| Supabase isolation | The additive assistant migration was applied. Two authenticated owners verified assistant-state round trips and isolation alongside the existing history, concurrency and private-storage checks. Temporary test identities were cleaned up. |
| Printed teacher plans | Letter and A4 teacher plans each rendered as four clean pages. All eight pages were visually inspected for clipping, working examples, prompts, answer keys, exit checks and separation from application controls. |
| Production artifacts | Production build passed; 32 browser assets contain no private reference transcript payload and 16 server traces exclude local credentials/runtime data. |

### Direct DeepSeek verification

The user explicitly configured direct DeepSeek with a private key. `AI_PROVIDER=deepseek` uses `deepseek-flash` for images and text and is billed to that account. OpenRouter remains a separate free-only configuration; neither provider silently falls back to the other or to prepared results.

- **Classroom chat:** a real HTTP request passed in 6.6 seconds against all 120 current answers, saved lessons and bounded history. It correctly separated Casey's two correct answers from one missing response and returned nine valid citations and two navigation actions. Earlier oversized free-provider requests and an invalid material citation were rejected; no unvalidated answer was saved.
- **Teaching brief:** a real HTTP request passed in 7.8 seconds and returned three class actions with twelve validated sources: extension for five students, a worked-error check for Devon, and completion checks for Casey and Harper. The saved 45-minute lesson and October 2 assessment stayed unchanged.
- **Final grounding checks:** a later brief refresh was rejected because a named student lacked that student's own work citation; the prior saved brief was retained. An isolated live chat check passed in 4.6 seconds after tightening the prompt: it distinguished Casey's prior supported work from independent answers and suggested an unhinted question with a clear success check. These are bounded checks, not a guarantee of instructional accuracy.
- **Analysis:** a direct live analysis of already teacher-corrected fictional baseline readings passed domain validation with eight findings and 8/8 next-step agreements against the saved teaching decisions. This is a text-model check, not an OCR result.
- **Lesson proposal:** one response had malformed JSON and was rejected. A bounded retry on cloned, previously confirmed fictional findings passed with three changes and a 45-minute lesson in 7.0 seconds. The diagnostic did not alter a saved teacher plan.
- **Handwriting:** a bounded run processed all 16 baseline/follow-up scans (48 responses). Exact normalized final-answer strings agreed on 43/48. Four differences were faithful labels such as `answer 2/5`, which exposed a parser limitation. Checker v3 now accepts only that narrow label syntax while preserving the original text; local re-evaluation of the captured results gives **47/48 numerical-and-unit agreement**, without another model call. One actual misreading remains: Harper's `7/12` was read as `?/12` with no final answer and was not marked uncertain. Teacher review is still required.
- **Full live chain:** that 19-call vision/analysis/planning run did **not** complete successfully. Before the parser fix, Blake's labeled answers were treated as unresolved, and an unsupported targeted placement was rejected. Follow-up analysis also failed the required prior-evidence rule for continuing extension. These failures were retained; they are not reported as a successful all-live demonstration. The subsequent analysis prompt now spells out the required current/prior extension references, and direct non-thinking calls use temperature zero; those changes do not retroactively turn the recorded run into a pass.

Private reports are in `.local/assistant-live-verification.json`, `.local/deepseek-brief-verification.json`, `.local/live-smoke.json`, `.local/live-reasoning-evaluation.json`, `.local/deepseek-proposal-verification.json`, `.local/live-evaluation.json` and `.local/live-evaluation-checker-v3.json`. No real student data was used, and no external teacher validated these outputs.

## Earlier analytics revision checks

| Check | Result and scope |
| --- | --- |
| Authored specification | The fixture validator covers all five assignments, answer keys, evidence cases, lesson timing, contracts and local document links. The expanded catalog has 40 scans, 120 responses and five 45-minute lessons. |
| Deterministic tests | 101 tests across 13 files passed. They cover disjoint answer counts, assistance, partial/duplicate uploads, exact fraction arithmetic, current and historical evidence, teacher corrections, catalog migration, proposal constraints, persistence, uploads, origin/auth boundaries, saved jobs, provider errors and asset integrity. |
| Browser acceptance | All five Chromium scenarios passed in 38 seconds without retries: correction and selected lesson changes; five-assignment loading and linked individual analytics; eight routes at 390 pixels and keyboard navigation; real PNG/PDF uploads; and partial uploads, unresolved flags and historical readings. Wrong-date planning is disabled with a link to the correct lesson; returning from history preserves the selected student and question. |
| Connected application | Thirteen real HTTP lifecycle checks passed against Supabase. Teacher cookies and private source uploads produced five assignments, 40 effective worksheets and 120 responses. Both earlier accepted lessons, corrections, observations and materials remained unchanged. New samples were not autoapproved; repeated loads and analysis were idempotent. Logout denied access. Zero live model calls. |
| Supabase isolation | Two temporary authenticated owners verified database RLS, private Storage, immutable history, rejected owner injection, concurrent/stale revision conflicts, and anonymous denial. A saved two-lesson classroom upgraded to five without rewriting accepted versions; a second read was idempotent. Temporary users and objects were removed. |
| Production build | Next.js production compilation passed. The artifact guard inspected 28 browser assets and 14 server traces: reference extraction payloads stayed out of browser bundles, and local credentials/runtime state stayed out of deployment traces. |
| Print inspection | Generated student activities and separate teacher keys were rendered and visually inspected. Actual browser print output was checked on US Letter and A4, including working space, fraction bars, unclipped text and separation of student directions from teacher guidance. |
| Asset integrity | All 59 manifest entries matched their file hashes. The 40 synthetic handwriting images are 1700 × 2200; each maps to its template and server-only prepared extraction. The original 16 scan hashes were preserved. Runtime lesson JSON validates against application contracts. All 14 authored PDFs and five assignment contact sheets were visually inspected. |
| Contrast and keyboard focus | Checked main text/background pairs: body 14.18:1, muted text 6.44:1, sidebar text 7.04:1, primary action 4.76:1 and upload action 8.71:1. Sidebar keyboard focus uses a white outline against violet. This is targeted visual verification, not a comprehensive accessibility certification. |
| Remote CI | The data/catalog checkpoint passed both Ubuntu jobs in [this run](https://github.com/RyanSXing/classcompass/actions/runs/35477031435). [GitHub Actions](https://github.com/RyanSXing/classcompass/actions/workflows/ci.yml) repeats credential-free validation and the browser suite for each interface checkpoint. |

The connected run summary is saved privately at `.local/connected-verification.json`; print inspections are in `.local/print-qa/`. Neither directory is committed. The public CI workflow repeats credential-free validation and the browser suite. The production app was restarted and manually checked to preserve saved evidence and proposals with no new browser warnings or errors.

## Historical OpenRouter evaluation

The earlier free-provider evaluation used the exact endpoints `google/gemma-4-26b-a4b-it:free` and `deepseek/deepseek-v4-flash-0731:free`. It does not silently substitute prepared outputs or a paid model.

Gemma returned provider rate limits, including after a roughly 20-minute cooldown. A tiny strict-JSON DeepSeek diagnostic succeeded in 1.16 seconds with reasoning disabled, but this did not predict full-task quality. Full-class text findings failed evidence/coverage checks, including incorrect claim scopes, cross-student references and unsupported interpretations. Grouping actual evidence by student and narrowing the output schema removed some structural errors; substantive analysis failures remained. A separate low-reasoning analysis reached the 75-second limit and did not trigger a planning call.

After constraining authored lesson/material IDs, **one live proposal passed domain validation and simulated application in 24.5 seconds**, using previously teacher-confirmed fictional findings. It covered all eight students within one 12-minute block and selected targeted support for Avery, Blake and Casey. Some other placements differed from the prepared recommendation. This establishes a bounded proposal integration result, not ideal instructional quality or successful live analysis. No actual classroom state was changed by the diagnostic, and no external teacher evaluated the model output.

The production default explicitly disables optional text reasoning; the low setting is evaluation-only. Neither tested setting established a complete live loop. Private reports include `.local/live-reasoning-initial.json`, `.local/live-reasoning-evaluation.json`, `.local/live-reasoning-low-evaluation.json` and `.local/live-gemma-diagnostic.json`. Rejected outputs remain outside the saved classroom; the application never silently switches to prepared outputs.

The original live handwriting evaluation has not completed: **0 of 16 scans and 0 of 48 responses were evaluated successfully. No accuracy percentage is claimed.** Those earlier free-provider checks did not evaluate the expanded five-assignment catalog. The later direct-provider checks are reported above. Prepared demonstration behavior remains available independently of provider capacity. See [implementation details](implementation.md) and run `npm run test:live` to measure current providers.

## Reproduce

```sh
npm ci
npx playwright install chromium
npm run verify
npm run test:e2e
```

Connected verification needs private Supabase configuration and the demo teacher login. Start a Supabase-backed instance on port 3002, then run `npm run test:supabase` and `npm run test:connected` as described in [Supabase setup](supabase-setup.md) and [implementation details](implementation.md). `npm run test:live` deliberately contacts the configured provider; direct DeepSeek requests are billed to the configured account.

Changing `AI_MODE` affects new processing. Refreshing findings reuses the saved, teacher-effective readings and does not erase corrections or re-transcribe existing submissions. Their original extraction provenance remains attached. Use a new upload/batch to evaluate fresh vision extraction after switching modes; mixed prepared/live stages must not be presented as an all-live OCR demonstration.

## Boundaries

This is a working prototype for the registered Grade 5 fraction unit. It has not been validated on real children's handwriting or in a real classroom. Teacher participation, a recorded submission video and a public hosted deployment are separate from the completed local application and repository. The calendar beyond the unit is a constrained preview. No measured learning gains, permanent mastery labels or general-purpose curriculum coverage are claimed.
