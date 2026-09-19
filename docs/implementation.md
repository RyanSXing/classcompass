# Implementation reference

ClassCompass implements one Grade 5 fraction-addition unit with five dated assignments and five lesson plans and a wider calendar preview. Teachers inspect original work, correct transcription or assistance context, confirm findings, and accept selected lesson changes. A follow-up revises the future lesson while preserving earlier observations and accepted plans.

## Architecture

| Layer | Implementation and responsibility |
| --- | --- |
| UI | Next.js App Router, React and TypeScript; Tailwind CSS, Radix primitives, local Nunito font and Lucide icons. Classroom, evidence review, lesson comparison, calendar, progress and printable pages share the same saved state. |
| HTTP boundary | [`app/api/[...path]/route.ts`](../app/api/%5B...path%5D/route.ts) is a Node-runtime route dispatcher. It authenticates the owner, checks mutation origins, parses bounded request schemas, and returns safe JSON errors. |
| Contracts and curriculum | [`lib/contracts.ts`](../lib/contracts.ts) defines Zod schemas and entity types. [`lib/curriculum.ts`](../lib/curriculum.ts) exposes authored questions, criteria, lessons, calendar constraints and materials. Student reference answers are separate from live request construction. |
| Domain | [`lib/domain`](../lib/domain) owns rational arithmetic, evidence eligibility, review revisions, plan timing/roster checks, selected application and immutable accepted versions. Model output cannot directly save a plan. |
| Persistence | [`lib/server/repository.ts`](../lib/server/repository.ts) provides the same read/transaction interface for local files and Supabase. [`storage.ts`](../lib/server/storage.ts) handles verified source/normalized upload objects. |
| AI | [`lib/server/ai.ts`](../lib/server/ai.ts) uses **native server-side `fetch` to OpenRouter**. There is no Vercel AI SDK or AI Gateway dependency. Each operation performs at most one provider call; the job service owns retries. |
| Jobs | [`lib/server/jobs.ts`](../lib/server/jobs.ts) persists extraction, analysis and proposal steps, claims expiring leases, enforces live request spacing, and rejects stale or late outputs. |
| Assets | [`public/demo`](../public/demo) contains explicitly fictional templates, 40 synthetic handwriting images, plan imports and sample PDFs. [`scripts/generate-assets.py`](../scripts/generate-assets.py) regenerates them deterministically. |

The model boundary is `extractWorksheet → analyzeEvidence → proposeLesson`. Live extraction uses `google/gemma-4-26b-a4b-it:free`; analysis and planning use the text-only `deepseek/deepseek-v4-flash-0731:free`. Extraction receives known questions and pixels, without reference transcripts, teacher support notes, intended cases or future answers. Analysis groups effective readings, recorded help and computed mathematics checks by student. Its output schema constrains finding codes to valid claim scopes and next-step categories. Proposals receive current confirmed evidence, lesson constraints and authored material options; their schema fixes valid block IDs, durations and material IDs. These constraints do not inject expected student groups. Zod and domain validation run before outputs become reviewable candidates.

Text requests explicitly disable optional reasoning to bound latency; the selected endpoint otherwise defaults to high reasoning. A low-effort override exists only for explicit evaluation. Reasoning settings are included in the provenance fingerprint. None of the tested settings has yet produced a validated full-class analysis in this environment, so the default is a transport configuration, not a quality endorsement.

Fixture mode resolves only recognized original asset hashes and template IDs. Its deterministic analysis/planning reads teacher-effective evidence and confirmations, so corrections change recommendations. The public asset manifest does not carry student answers. Server-only [`lib/fixtures/extractions.json`](../lib/fixtures/extractions.json) holds prepared readings, including Finley's disclosed uncertain misread. No failure silently changes mode or selects a paid endpoint.

## Local and connected operation

**Local:** `DATA_BACKEND=local` uses a single fixed demo-teacher identity, loopback-only requests, a JSON state file and private files beneath `LOCAL_DATA_DIR` (default `.local/classcompass`). It has no sign-in requirement and is intended for this machine's fictional demo. File locks and atomic rename protect transactions; failed domain operations do not save partial state. `APP_DEPLOYMENT=hosted` or a Vercel environment rejects this backend.

**Supabase:** `DATA_BACKEND=supabase` uses a pre-provisioned teacher email/password session through `@supabase/ssr`. The server validates the user and performs database/private-storage operations with that user's session. Versioned migrations create owner-scoped entity tables, RLS, immutable-history rules and state reconstruction/commit RPCs. Commits use an owner transaction lock plus an expected classroom revision. The runtime never requires the admin secret; deliberate provisioning and integration tests do. See [Supabase setup](supabase-setup.md) for migrations and the credential-gated verification procedure. Do not infer a passing connected check from the presence of these adapters.

Uploads are prepared, written and finalized before a batch can use them. Finalization verifies source identity, file signature/type, size, dimensions/page limits and hashes, retaining original and normalized associations. Student worksheets accept PNG/JPEG or a one-page PDF, up to 5 MiB. Lesson import accepts the bounded runtime JSON or text PDFs up to three pages. The current PDF parser recognizes the authored lesson structure; arbitrary layouts require an editable/manual recovery path rather than a fabricated source interpretation.

## Routes and operations

| Browser route | Purpose |
| --- | --- |
| `/classroom` | Assignment results, dated count distributions, question breakdowns and next actions. `?upload=work` opens upload. |
| `/assignments` | Five dated assignment summaries and the idempotent sample-class loader. |
| `/students` | Searchable roster with assignment-specific results. |
| `/plans` | Explicit dated lesson list, import and calendar access. |
| `/review/[batchId]` | Student-by-question results table, source inspector, separate reading checks and teaching notes. Filters use `student`, `question`, `result`, `support`; `response`, `revision` and `observation` select exact historical evidence. |
| `/plans/[lessonId]` | Current version, proposed before/after changes, bounded edits and selected application. |
| `/materials/[planVersionId]` | Materials tied to an accepted version; student sheets and separate teacher guidance. |
| `/calendar` | Authored schedule, accepted checkpoint and separately labeled pending proposal effects. |
| `/students/[studentId]` | Dated assignment counts, result/help filters, current skill evidence and earlier reviewed versions. |
| `/login` | Connected teacher sign-in. `/` redirects to the classroom. |

Key API families are `/api/uploads/prepare`, `/api/uploads/:id/{content,complete}`, `/api/lesson-imports`, `/api/batches`, `/api/jobs/:id/{run-next,retry,cancel}`, `/api/responses/:id`, `/api/submissions/:id/support`, `/api/findings/review`, `/api/plans/:id/proposals`, and `/api/proposals/:id/apply`. Reads include classroom, batch, asset, proposal, calendar, student-progress and version-material endpoints. [The dispatcher](../app/api/%5B...path%5D/route.ts) is authoritative for implemented routes; [document 03](03-data-and-api-contracts.md) explains their contracts. Responses use `{data: ...}` or `{error: {code, message, ...}}`.

## Analytics and sample catalog

`lib/assignments.ts` maps five known templates to dates, lesson targets and eligibility rules. `lib/analytics.ts` supplies pure selectors shared by the overview, assignment table and student pages. It selects the latest effective upload per assignment/student, counts every expected question once, and keeps unresolved flags out of incorrect-answer totals. Numeric correctness, working, units, assistance and teacher approval are independent facets. Charts use counts; differing tasks or assistance are not presented as measured growth.

`getCurrentSkillFindings` selects current confirmed evidence per student and objective. Newer unreviewed work prevents an old note from appearing current. Historical links resolve recorded response revisions and assistance snapshots. Checker version 2 revalidates current interpretations without rewriting stored earlier checks.

The additive catalog upgrade appends missing lessons and calendar associations to existing local and Supabase state, preserving saved versions and corrections. A catalog version participates in job fingerprints. Schema version 1 and the existing persisted entity arrays remain compatible.

`POST /api/demo/load` accepts `templateId` (legacy `phase` remains supported); `POST /api/demo/analyze` accepts `batchId` and explicitly uses prepared readings for verified sample files, regardless of the live-mode setting. Neither approves teaching notes. The UI processes one assignment at a time, reports progress and can resume without resetting existing work.

## Revision and instructional safeguards

- Effective response and assistance corrections preserve source extraction and append history. They stale dependent findings/drafts while preserving unrelated confirmations and accepted plan versions.
- Findings cite the exact student response revisions. They must include current-batch work, cannot borrow later work, and cannot turn blank/uncertain evidence or unknown assistance into demonstrated independence. The original quick check requires reviewed prior extension plus both fresh independent responses. Later assignments can newly qualify extension using their own catalog evidence threshold.
- A proposal binds the current lesson version, evidence revision and calendar revision. Selected application is transactional and idempotent. Conflicts require a fresh proposal; zero selected changes preserves the saved plan.
- Blocks remain `5 + 8 + 12 + 15 + 5 = 45` minutes. Three concurrent practice pathways cover every active student once within the same 12 minutes, with at most one teacher-led pathway. Fixed assessment dates, objectives and teaching-day constraints remain checked.
- Published material sets come from accepted content. An unselected change cannot publish its exclusive printable. Later revisions retain material references for an accepted checkpoint, while earlier material sets remain immutable.
- Job status reads never invoke a model. The browser explicitly dispatches one step at a time; leaving the page pauses further dispatch. Leases and fingerprints prevent duplicate commits and discard results generated against corrected inputs. Live starts are spaced at least four seconds; provider calls time out within 75 seconds, with at most three configured attempts per step and bounded retry waits.

## Verification and limits

`npm run verify` performs fixture validation, lint, type checking, deterministic tests and a production build. `npm run test:e2e` uses Chromium against port 3001 with isolated `.local/e2e` data and `.next-e2e` build output. It uses the local/fixture workflow and does not contact model providers. The [CI workflow](../.github/workflows/ci.yml) runs these checks on Ubuntu with Node 24, installs Chromium's Linux dependencies, and retains failure logs/report/traces for seven days. Workflow creation alone does not establish a passing remote CI run.

`npm run test:live` and `npm run test:supabase` are explicit credential-gated checks, excluded from public CI and ordinary startup. Live evaluation compares outputs to server-side reference data only after inference. Gemma remained rate-limited on September 19, 2026: **0/16 scans and 0/48 responses measured; handwriting quality remains unmeasured.** DeepSeek returned structured text, but full-class findings failed semantic/evidence/coverage checks. Tightening the proposal schema produced one validated live proposal from previously confirmed fictional findings. An additional low-reasoning analysis timed out at 75 seconds. No complete live loop passed, no paid fallback was used, and rejected findings did not enter the classroom. Local, browser, production and real Supabase checks passed separately; see [verification results](verification-results.md).

For a bounded text-only diagnostic after preparing the fictional local classroom, run `npm run test:live -- --reasoning-evaluation`. It clones effective readings and teacher-confirmed findings, performs live text calls, and records domain validation and comparisons privately without changing the classroom or pretending to evaluate handwriting. `--low` tests the supported low reasoning effort and skips planning if analysis fails; `--followup` selects the follow-up evaluation. The default source is `.local/classcompass/state.json` for baseline and `.local/e2e/state.json` for follow-up; `LIVE_REASONING_STATE_FILE` can select another explicitly fictional saved workspace. Reports are written with mode `0600` beneath `.local/`. Keep raw diagnostics private.

`npm run test:connected` runs the real HTTP workflow against an already running **Supabase + fixture** server. `CONNECTED_BASE_URL` defaults to `http://127.0.0.1:3002` and must target loopback. `CONNECTED_LOGIN_FILE` defaults to the ignored, private `.local/teacher-login.json` containing the pre-provisioned teacher's `email`, `password` and `projectURL`. Keep this file mode `0600`; never commit it. The script keeps cookies in memory, performs a signed private PDF upload and preview, runs both worksheet/review/accepted-lesson cycles, checks progress/history, then logs out and verifies unauthorized access fails. It intentionally writes and preserves real **fictional demonstration state** in that teacher's connected classroom; reruns reuse the latest batches and accepted plans instead of resetting history. It does not use mocks or call external models. Ordinary requests have a 20-second timeout and the eight-file sample load has a 120-second timeout. The credential-free summary is written to `.local/connected-verification.json`. Unlike the temporary-account isolation suite, use this command only for the designated demo teacher, not an unrelated classroom.

The prototype is bounded to eight fictional students, five registered worksheet layouts, one skill-focused unit and authored material choices. It does not establish OCR quality on real children's handwriting, educational efficacy, time savings, autonomous curriculum generation, whole-school scaling or production readiness. The year view is a constraint-preserving preview. Teacher support context is submission-wide. A real Grade 5 teacher's participation and classroom validation remain unconfirmed.

CI configuration references were checked through Context7 and current official sources: [GitHub Node.js workflows](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs), [checkout v7](https://github.com/actions/checkout), [setup-node v7](https://github.com/actions/setup-node), [upload-artifact v7](https://github.com/actions/upload-artifact), and [Playwright CI](https://playwright.dev/docs/ci). Provider catalog reference: [OpenRouter models API](https://openrouter.ai/api/v1/models).
