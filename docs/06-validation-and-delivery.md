# Validation and delivery plan

This is the **future implementation verification contract**. The documentation task does not establish that an application, generated assets, model evaluation, browser test, or connected deployment exists. Record documentation checks separately from application checks. Report each implementation check as passed, failed, or not run with its reason and evidence.

## Build as coherent vertical slices

Implement in dependency order, keeping each completed slice usable through the interface:

1. **Foundation and authored inputs:** shared schemas, repository interface, local persistence, mode badges, classroom, lesson import, roster, registered worksheet templates, and reproducible fictional assets. Verify the original 45-minute plan before adding analysis.
2. **One response through review:** upload a real generated scan, retain original/normalized assets, extract through the provider interface, compute mathematics, show evidence, save a correction, and reload persisted state. Add the remaining submissions through the same path.
3. **Teacher-reviewed planning:** individual and selected pattern confirmation, proposal generation, before/after evidence, teacher edits, stale-state handling, atomic selected application, versioned materials, and calendar effects.
4. **Close the loop:** ingest the independent follow-up, append observations, and revise the authored September 25 lesson. Preserve September 23 as taught history.
5. **Connected operation and finishing:** Supabase migrations/RLS/storage/auth, OpenRouter adapters, resumable job handling, browser/print checks, diagnostics, and documentation. Implement adapters early enough to avoid making connected behavior a separate application.

Do not wait until the end to connect screens. A polished screen without its persisted action is incomplete. This sequence assigns work to implementation stages, not assumed teammate specialties.

## Expected scripts and clean-run contract

Create and document these npm scripts during implementation. They are not available merely because this file exists.

| Script | Required purpose |
| --- | --- |
| `dev`, `build`, `start` | Development, production compilation, and production serving; local mode binds loopback. |
| `fixtures:validate` | Validate authored fixture structure, references, all rational answer keys, dates, totals, and asset manifest. |
| `assets:generate` | Reproducibly create templates, synthetic scans when needed, import examples, and teacher keys with truthful labels. |
| `demo:seed`, `demo:reset` | Populate/reset only the local fictional store; reset is explicitly destructive to generated demo state. |
| `lint`, `typecheck`, `test` | Linting, TypeScript checking, and deterministic domain/service integration tests. |
| `test:e2e` | Playwright workflow tests using an isolated local/fixture store and no provider requests. |
| `verify` | Fixture validation, lint, type checking, unit/integration tests, and production build; fail on any failed stage. |
| `test:live`, `test:supabase` | Explicit credential-gated suites; missing configuration reports not run, never a passing connected result. |

After creating the lockfile, the documented clean local path is:

```sh
npm ci
npm run fixtures:validate
npm run assets:generate
npm run demo:seed
npm run verify
npm run test:e2e
npm run dev
```

Configure defaults from `.env.example`; local/fixture requires no external credentials. Install the browser runtime needed by Playwright in the documented setup. Tests isolate state and never reset a teacher's active store. Document a separate deliberate Supabase migration/provisioning/seed procedure; never run administrative seeding as part of ordinary startup or `verify`.

## Required deterministic verification

Use meaningful assertions at domain and service boundaries. Mock provider transport and clocks for failure/concurrency tests rather than waiting through real timeouts.

| Test ID | Assertions | Product coverage |
| --- | --- | --- |
| V01 Math | Exact rational checks accept `3/6 = 1/2`, nonleast denominators, and valid intermediate equivalences. Missing units remain separate from numerical correctness. Blanks/unparseable answers stay unresolved; zero denominators, oversized integers, mixed syntax, and code-like input cannot be evaluated. Contradictory chains require review. | P02, P04, P11 |
| V02 Findings | A repeated denominator-addition candidate needs evidence on two distinct clear responses. A lone wrong answer cannot establish it. Unknown support blocks independence; supported correctness remains correct. New extension requires the specified reviewed evidence; continued extension accepts confirmed unsuperseded baseline evidence plus both new independent follow-up responses, without inventing a third follow-up question. | P03, P04, P06 |
| V03 Review | Pattern and individual actions mutate the same per-student findings. Batch review is all-or-nothing on revision conflict. Transcription/support edits retain originals, stale dependencies, and leave unrelated confirmations intact. Teacher-authored/semantically overridden findings require explicit confirmation, retain prior provenance, and cannot bypass arithmetic/support gates. Confirm/reject/override increments evidence revision and invalidates drafts; repeated confirmation creates no duplicate observation. | P03–P07 |
| V04 Plan integrity | Blocks remain `5+8+12+15+5=45`. The three concurrent lanes count as 12 elapsed minutes, cover every active student exactly once, and have at most one teacher-led lane. Entry-check students belong to their lane. Reject duplicates, missing students, invalid dependencies, invented references, moved locked dates, and exceeded checkpoint capacity. | P06–P10 |
| V05 Atomic apply | Reject stale evidence/calendar/base-plan versions. Applying selected valid changes creates exactly one plan version, material set, and coherent calendar update. A forced transaction failure writes none. Same idempotency key/body returns the original result; a different body conflicts. Zero selections preserve the plan. Unselected optional exit/checkpoint operations do not change the saved schedule or publish their exclusively referenced materials; selected dependencies must hold. | P07–P10 |
| V06 History | Corrections append superseding observations. Accepted plans/materials remain immutable. Follow-up creates a proposal for `lesson-2026-09-25`, never a retrospective September 23 replacement. | P05, P07, P11 |
| V07 Import | Prepared lesson PDF/JSON imports preview before confirmation; invalid totals fail. Unsupported layouts offer editable/manual recovery without silently injecting the seed lesson. | P01, P08 |

Test repository service invariants against the local adapter and, when configured, the Supabase adapter. Do not duplicate every pure arithmetic case through a browser.

## Jobs, uploads, and failure recovery

Verify that simultaneous `run-next` requests claim one step, read-only status calls never start inference, and the teacher-wide dispatch gate enforces spacing. Test expired leases, incorrect lease tokens, edits during inference, cancellation, and late outputs: none may overwrite current teacher changes or create duplicate results. Cached extraction must preserve corrections. Test bounded 429/timeout/5xx retries with `Retry-After`, quota-blocked state, explicit retry after exhaustion, malformed model JSON, and unknown evidence IDs. No failure may trigger a silent fixture or paid-model fallback. These checks cover P05, P06, and P12.

Fixture extraction recognizes asset hashes/template IDs, not filenames. An unrelated upload cannot receive scripted answers. Mutate effective answers, support and confirmations to prove fixture proposals recompute; test that expected group assignments/reference transcripts never enter live requests.

Exercise upload prepare → bytes → finalize, including an interrupted upload. A batch cannot analyze assets before finalization verifies stored size, signature/type, hash, dimensions, ownership, and source/derivative association. Reject oversized, encrypted, unsupported, or wrongly mapped files and path traversal. Repeated finalization is safe. A partly failed extraction preserves completed records; complete analysis waits for all selected submissions or an explicitly revised partial batch. Closing/navigating away pauses dispatch; reopening resumes persisted progress without duplicating completed observations. These checks cover P01 and P12.

## Browser acceptance journey

Use generated source files through the actual upload controls, not direct insertion of completed findings. At 1280×800, verify this complete local/fixture journey and save representative screenshots:

1. Import the prepared lesson; upload eight baseline scans. Inspect all 32 source/question associations and visible fictional/fixture labels. Reload to confirm persistence.
2. Review the Avery/Blake/Casey pattern in a batch, then open an individual response. Ambiguous and insufficient work cannot become definitive misconception evidence by bulk confirmation.
3. Correct Finley (`stu-06`, `q-03`) from prepared `1/5` to `1/2`. The original scan/extraction and labeled simulated error remain accessible; the check and eligible proposal update after reconfirmation. Nothing changes in the saved lesson yet.
4. Change Gray (`stu-07`) to supported, with the teacher's prompt note applying to the submission. Arithmetic stays correct; the proposed independent-performance interpretation and extension placement change to an independent check. History retains the correction.
5. Inspect linked evidence and before/after content, edit a change, keep another original, and apply a valid selected set. Verify 45/12-minute invariants, roster coverage, accepted materials, and preserved October 2 assessment/October 5–9 next-unit dates.
6. Upload and review all 16 follow-up responses. Blake (`stu-02`) receives credit for **`3/6 meter`**. Avery/Blake return to application; Casey retains targeted support; Gray gains new independent evidence without losing supported baseline history; Harper's one completed response remains recorded and the blank prompts more evidence.
7. Open and apply the September 25 proposal. Assert September 23's accepted version/materials remain unchanged. Reload student histories and calendar to prove persistence.

Add focused browser tests for stale-apply rejection, refresh with teacher-edited drafts, session recovery, partial failure/retry, and every navigation destination. Check mobile at approximately 390×844, keyboard-only primary actions, visible focus, accessible names, zoomed evidence, and absence of horizontal clipping. Trace this journey to P01–P12; it is the minimum working product, not optional presentation polish.

Visually verify document 10's Blooket-inspired direction at 1280×800 and 390×844: violet sidebar/mobile drawer, raised primary controls, rounded headings and colorful card hierarchy. Check original ClassCompass branding/assets, actual text/background contrast, keyboard focus on both light and saturated surfaces, visible fixture/review/stale states, and the readability of side-by-side source evidence and lesson changes. Activity colors must not imply student ranks, and card styling must not split the single 12-minute block into independently applicable lanes. Compare against the authored design requirements; no Blooket screenshot or asset belongs in the application bundle. This is a visual QA task, not a pixel-comparison test against Blooket.

## Connected security and live-model gates

Use a designated test Supabase project and temporary test identities. Verify unauthenticated requests fail; guessed cross-owner IDs cannot read or mutate students, findings, jobs, imports, plans, or materials; RLS also rejects direct cross-owner table access. Signed upload preparation/finalization cannot target another owner's object or create arbitrary paths. Private uploaded files have no public read path. Authorized signed previews expire and refresh; issuance requires ownership. Session expiry preserves unsaved UI text while blocking mutations. Invalid origins and client-supplied owner/status overrides fail.

Assert the documented HTTP error mapping, including 401 without a session, 404 for inaccessible records, 409 for revisions, 422 for invalid semantics, and safe 429/503 provider failures. Errors expose no secrets or raw student submissions.

Inspect client bundles, responses, logs, errors, and git-tracked files for OpenRouter/admin secrets. Only intended public Supabase configuration may reach the browser. Escape model/worksheet text; injected instructions cannot modify records, reveal keys, or enter executable HTML. Confirm hosted configuration rejects the local filesystem backend. These tests cover P01, P05, P07, and P12.

With an OpenRouter key, test both configured model IDs and capabilities, then compare real extraction against **all 32 baseline and 16 follow-up responses**. Record exact models, timestamps, correct/uncertain/incorrect transcriptions, observed latency, and correction needs. Do not send reference transcripts, intended groups, or future answers to live inference. Evaluate evidence references and proposed arithmetic/timing after reasoning. Accurate synthetic-sample recognition does not establish real-child handwriting quality. Model unavailability or poor results must be reported; absent credentials leave this gate **not run**, while deterministic adapter/failure tests still run.

## Print and delivery gate

Inspect generated print output on US Letter and A4. Check fraction symbols/models, working space, margins, page breaks, absence of clipped questions, and separation of teacher keys from student sheets. Printables must match the accepted plan version and exclude diagnostic group labels. Save evidence of visual inspection; successful PDF generation alone is insufficient. Coverage: P09.

Before declaring implementation ready, run the clean local path, production build and production smoke test; check all routes/actions, restart persistence, env/setup instructions, mode badges, asset manifest, and unresolved issue list. Report connected/live checks separately. Do not claim a deployment or publication occurred unless explicitly performed and verified.

Prepare a submission README covering purpose, setup/modes, architecture, model/data disclosure, limitations, tests, and demo instructions. Include a five-slide deck outline: problem/teacher loop; evidence and corrections; accepted lesson/material/calendar; architecture and verification; impact and future scope. Follow the 4:50 script in document 04; final video must be **at most five minutes**. Label shortened processing waits and prepared corrections accurately. Use fictional data throughout.

The guide recorded in the project sources sets code/submission freeze at **September 20, 2026, 11:59 PM Pacific**, with a public repository, README, slides link, and video. Recheck the official guide before submission. Creating these docs does not authorize uploading a video, making a repository public, submitting the entry, or deploying the app. Prepare reviewable deliverables locally and report any remaining publication steps.
