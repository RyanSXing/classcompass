# ClassCompass

**A teacher-controlled lesson planner that connects student work to what gets taught next.**

Upload work → review the evidence → adjust instruction → teach → check progress.

ClassCompass is a working Grade 5 fraction-addition prototype. Its overview connects the current work to concrete teaching actions: who needs what, the supporting answers, an activity, time, and a check for success. Teachers can generate a cited teaching brief, ask the classroom assistant questions, correct evidence, and save selected changes to a complete lesson plan. The interface retains its original purple and aqua design.

[Demo and recording guide](docs/demo-guide.md) · [Implementation reference](docs/implementation.md) · [Supabase setup](docs/supabase-setup.md) · [Public repository](https://github.com/RyanSXing/classcompass)

## Run locally

Use Node 24 (see `.nvmrc`). No service credentials are needed for the complete prepared demonstration.

```sh
npm ci
# For a fresh checkout only; preserve an existing .env.local.
cp .env.example .env.local
npm run dev
```

Open [ClassCompass](http://127.0.0.1:3000). Choose **Assignments → Load sample class** to explore five assignments, 40 worksheets and 120 answers from the same eight fictional students. This uses prepared results and preserves existing corrections and reviews. For the step-by-step correction demo, choose **Upload work → First check → Load sample worksheets**, then **Analyze this upload**.

Local work persists in `.local/classcompass` across reloads and restarts. Local mode is restricted to loopback access and is refused in a hosted deployment. Credentials and runtime data are Git-ignored.

```sh
npm run demo:seed          # Optional: load the baseline files through normal validation
npm run demo:reset -- --yes # Deliberately reset only the local fictional workspace
npm run build
npm start
```

Use the reset command only for a dedicated fictional demo workspace.

## What the demo covers

- Eight fictional students, five dated assignments, 120 answers and five 45-minute lesson plans.
- A teaching brief generated from saved classroom evidence and teacher goals, with cited actions. Data-based starting points remain available before generation and after a provider error.
- Three analytics views: **Class results**, **Students over time**, and **Question patterns**. The class matrix follows all eight students across five dates; question patterns distinguish wrong values, common-unit working, missing units and incomplete explanations.
- A **Compare with** chooser for earlier assignments. Comparisons use the same students' usable independent core results and show changes in tasks or help; they do not claim measured learning gains.
- A classroom **Assistant** with saved teaching goals, persistent conversation, assignment/student/lesson context, and links to its sources. Suggestions do not approve notes or change lessons.
- Separate correct, incorrect, flagged, unanswered, unprocessed and missing results. Help, units and reasoning stay visible as separate details.
- PNG/JPEG and one-page worksheet PDF uploads, student mapping, support context, private originals, and source crops.
- Editable lesson imports from the supplied PDF or structured JSON, with an explicit preview before saving.
- Exact rational arithmetic, equivalent unreduced answers, contradictory steps, uncertain readings, and incomplete work.
- Separate candidate findings, teacher confirmations, dated skill observations, and accepted lesson versions.
- Complete 45-minute teacher plans with objectives, success criteria, preparation, materials, timed instruction, worked examples, questions, practice and checks. Authored guidance is labeled separately from model suggestions; saved instructions and teacher edits are preserved.
- Proposed lesson changes include a 12-minute practice block with simultaneous groups, an optional exit activity, and an optional eight-minute follow-up checkpoint within the existing teaching time. Teachers inspect evidence beside each change and choose what to save.
- A ten-day unit calendar with a fixed assessment and a wider calendar preview.
- Printable full teacher plans, version-bound student activities and separate answer keys. Historical evidence and accepted plans remain inspectable.
- Saved processing jobs, retries, cancellation, duplicate-request protection, and rejection of stale model results.

The prepared correction cases are explicit: Finley’s source contains `1/2` but the prepared extraction deliberately reads `1/5`; Gray’s initially entered independent condition is corrected to supported. Live mode never injects either mistake.

## Real services

The frontend and backend use Next.js App Router, React, TypeScript, Tailwind, Radix primitives, and Zod. Supabase supplies connected authentication, PostgreSQL, and private Storage. Native server-side requests call the explicitly selected OpenRouter or direct DeepSeek provider; deterministic domain code validates model output before it affects the review workflow.

Storage, execution mode and provider are configured separately:

| Setting | Choices |
| --- | --- |
| `DATA_BACKEND` | `local` for a persistent single-machine demo; `supabase` for authenticated connected storage |
| `AI_MODE` | `fixture` for disclosed prepared outputs; `live` for actual calls to the selected provider |
| `AI_PROVIDER` | `openrouter` for free models only; `deepseek` for direct calls billed to your DeepSeek account |

For direct DeepSeek, set `AI_PROVIDER=deepseek`, add `DEEPSEEK_API_KEY` to `.env.local`, and set `AI_MODE=live` for worksheet processing. Both `DEEPSEEK_VISION_MODEL` and `DEEPSEEK_REASONING_MODEL` default to `deepseek-flash`. Direct calls are billed to the configured DeepSeek account. A fresh eight-worksheet live check completed handwriting extraction, findings and a valid lesson proposal in ten calls. This was fictional data with simulated teacher review; see the [teacher workflow audit](docs/teacher-workflow-audit.md) and [verification results](docs/verification-results.md) for scope and limits.

For free-only OpenRouter, set `AI_PROVIDER=openrouter` and add `OPENROUTER_API_KEY`. The configured models are Gemma for transcription and DeepSeek for analysis/planning. **The free-provider path is not validated for an all-live demo:** Gemma returned rate limits; DeepSeek's full-class findings failed evidence/coverage checks, and a low-reasoning attempt timed out. One live lesson proposal passed validation using previously confirmed fictional findings, but that did not establish a successful live analysis loop. Provider failures stay visible. Neither provider silently switches to the other, to prepared results, or to a paid model; direct DeepSeek requires explicit selection.

The overview's **Teaching insights mode** and the Assistant's mode chooser can request **Live AI** from the selected provider while worksheet readings remain prepared. Each brief, chat answer and reading retains its own provenance. **Sample** assistance is generated from current saved data and is labeled explicitly. Saved goals and evidence changes mark prior briefs as needing an update. Successful text assistance does not establish live handwriting accuracy; the verification record reports these checks separately.

For connected storage, follow [Supabase setup](docs/supabase-setup.md). Apply all migrations, configure the project URL and publishable key, provision the demo teacher with `npm run teacher:provision`, and set `DATA_BACKEND=supabase`. The provisioning command stores the generated login only in `.local/teacher-login.json`. The admin secret is used by explicit local setup/test scripts; ordinary application requests use the signed-in teacher’s identity. Public signup is disabled for the provisioned demo project.

## Validation

```sh
npm run verify        # Authored specifications, lint, TypeScript, unit/service tests, production build
npm run test:e2e      # Isolated Chromium teacher journey on port 3001
npm run test:supabase # Real two-owner database/Storage isolation checks; requires private admin configuration
npm run test:connected # Real app HTTP lifecycle against the connected server (see implementation docs)
npm run test:live     # Actual provider evaluation; failures are reported without substituting fixtures
```

Install the test browser once with `npx playwright install chromium` (Linux CI also uses `--with-deps`). GitHub Actions runs credential-free verification and browser tests on each push. The production build checks that private reference transcripts do not enter browser assets and local credentials/runtime data are excluded from deployment traces.

The browser tests use `.local/e2e` and `.next-e2e`; they do not reset the normal demo workspace. See [verification results](docs/verification-results.md) for the exact checks completed and remaining external limitations.

## Demo files and scope

[Blank baseline worksheet](public/demo/baseline-template-v1.pdf) · [Follow-up worksheet](public/demo/followup-template-v1.pdf) · [Original lesson PDF](public/demo/lesson-2026-09-23-original.pdf) · [Runtime lesson JSON](public/demo/lesson-2026-09-23-original.json) · [Teacher keys](public/demo/classcompass-teacher-answer-keys.pdf)

All student identities and work are fictional. The handwritten scans are generated demonstration assets. [Asset generation](docs/asset-generation.md) documents the reproducible generator and the Nunito/Caveat font licenses. The UI uses original branding, shapes, and code; no Blooket assets are included.

This prototype supports one known Grade 5 unit and previews its calendar impact. It does not claim arbitrary worksheet recognition, general curriculum planning, permanent student mastery scores, or validated educational outcomes. Teacher participation in the recorded demo remains optional and unconfirmed.

## Original specifications

| Document | Purpose |
| --- | --- |
| [00 — Decisions and scope](docs/00-decisions-and-scope.md) | Confirmed product decisions and completion boundary |
| [01 — Product and UX](docs/01-product-and-ux.md) | Teacher workflows and screen requirements |
| [02 — Architecture and operations](docs/02-architecture-and-operations.md) | Storage, authentication, uploads and processing |
| [03 — Data and API contracts](docs/03-data-and-api-contracts.md) | Entities, routes, revisions and invariants |
| [04 — Demo and curriculum](docs/04-demo-and-curriculum.md) | Authored lessons, worksheets and scenarios |
| [05 — AI contracts and prompts](docs/05-ai-contracts-and-prompts.md) | Model responsibilities and evidence boundaries |
| [06 — Validation and delivery](docs/06-validation-and-delivery.md) | Acceptance requirements |
| [07 — One-shot build prompt](docs/07-one-shot-build-prompt.md) | Original implementation brief |
| [08 — Sources and assumptions](docs/08-sources-and-assumptions.md) | External sources and volatile assumptions |
| [09 — Specification verification](docs/09-specification-verification.md) | Historical document/fixture verification |
| [10 — Visual design](docs/10-visual-design.md) | Design tokens and original visual direction |
| [11 — UX and analytics revamp](docs/11-ux-analytics-revamp.md) | Navigation, result rules and five-assignment scope |
| [12 — AI teaching workspace](docs/12-ai-teaching-workspace.md) | Teaching briefs, richer analytics, classroom assistant and complete teacher plans |

Documents 00–10 preserve the original specification. Document 11 supersedes their screen layouts and two-assignment limits. Document 12 supersedes the earlier overview and lesson presentation while retaining the result definitions and teacher approval rules. The implementation reference and verification results describe what was built and tested. The [classroom fixture](docs/fixtures/classroom.json) is authored reference/test data; its historical “specified-not-generated” flags are not the current delivery status. The actual generated files are listed in [the asset manifest](public/demo/manifest.json).
