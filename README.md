# ClassCompass

**A teacher-controlled lesson planner that connects student work to what gets taught next.**

Upload work → review the evidence → adjust instruction → teach → check progress.

ClassCompass is a working Grade 5 fraction-addition prototype with an original, Blooket-inspired teacher dashboard. The central planner places original student work beside a proposed lesson change. Teachers can correct readings, record actual help, edit interpretations, accept individual changes, print activities, and see how fresh work changes the next lesson.

[Demo and recording guide](docs/demo-guide.md) · [Implementation reference](docs/implementation.md) · [Supabase setup](docs/supabase-setup.md) · [Public repository](https://github.com/RyanSXing/classcompass)

## Run locally

Use Node 24 (see `.nvmrc`). No service credentials are needed for the complete prepared demonstration.

```sh
npm ci
# For a fresh checkout only; preserve an existing .env.local.
cp .env.example .env.local
npm run dev
```

Open [ClassCompass](http://127.0.0.1:3000). Choose **Upload work → Load fictional baseline work**, then **Start analysis**. The eight synthetic worksheets use clearly labeled prepared outputs. The application recomputes findings and plans from teacher corrections; it does not play a fixed sequence of screens.

Local work persists in `.local/classcompass` across reloads and restarts. Local mode is restricted to loopback access and is refused in a hosted deployment. Credentials and runtime data are Git-ignored.

```sh
npm run demo:seed          # Optional: load the baseline files through normal validation
npm run demo:reset -- --yes # Deliberately reset only the local fictional workspace
npm run build
npm start
```

The UI also includes a confirmed **Reset demo** action in local fixture mode.

## What the demo covers

- Eight fictional students, four baseline questions, two follow-up questions, and two 45-minute lessons.
- PNG/JPEG and one-page worksheet PDF uploads, student mapping, support context, private originals, and source crops.
- Editable lesson imports from the supplied PDF or structured JSON, with an explicit preview before saving.
- Exact rational arithmetic, equivalent unreduced answers, contradictory steps, uncertain readings, and incomplete work.
- Separate candidate findings, teacher confirmations, dated skill observations, and accepted lesson versions.
- A 12-minute practice block with three concurrent pathways, an optional exit activity, and an optional eight-minute follow-up checkpoint within the existing teaching time.
- A ten-day unit calendar with a fixed assessment and a wider calendar preview.
- Version-bound student printables and separate teacher keys. Historical evidence and accepted plans remain inspectable.
- Saved processing jobs, retries, cancellation, duplicate-request protection, and rejection of stale model results.

The prepared correction cases are explicit: Finley’s source contains `1/2` but the prepared extraction deliberately reads `1/5`; Gray’s initially entered independent condition is corrected to supported. Live mode never injects either mistake.

## Real services

The frontend and backend use Next.js App Router, React, TypeScript, Tailwind, Radix primitives, and Zod. Supabase supplies connected authentication, PostgreSQL, and private Storage. Native server-side requests call OpenRouter; deterministic domain code validates model output before it affects the review workflow.

The two switches are independent:

| Setting | Choices |
| --- | --- |
| `DATA_BACKEND` | `local` for a persistent single-machine demo; `supabase` for authenticated connected storage |
| `AI_MODE` | `fixture` for disclosed prepared outputs; `live` for actual OpenRouter calls |

For live analysis, place `OPENROUTER_API_KEY` in `.env.local` and choose `AI_MODE=live`. The configured free models are Gemma for transcription and DeepSeek for analysis/planning. Provider failures stay visible; there is no silent fixture or paid-model fallback. **The current free providers are not validated for an all-live demo:** Gemma returned rate limits; DeepSeek's full-class findings failed evidence/coverage checks, and a low-reasoning attempt timed out. One live lesson proposal passed validation using previously confirmed fictional findings, but that does not establish a successful live analysis loop. Use the disclosed prepared mode for the demonstration and see [verification results](docs/verification-results.md) for exact limits and repeatable live checks.

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

The numbered documents preserve the original specification. The implementation reference and verification results describe what was built and tested. The [classroom fixture](docs/fixtures/classroom.json) is authored reference/test data; its historical “specified-not-generated” flags are not the current delivery status. The actual generated files are listed in [the asset manifest](public/demo/manifest.json).
