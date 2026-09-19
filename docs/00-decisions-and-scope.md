# Decisions and scope

Status: ready for implementation. Prepared September 19, 2026. This is a specification package, not a claim that the application or live model tests exist.

## Authority and reading order

The latest user instruction takes precedence. Within this package, this decision register defines scope, `03-data-and-api-contracts.md` defines field names and state transitions, and `04-demo-and-curriculum.md` plus its JSON fixture define authored teaching content. Document 01 defines product behavior and screen composition; document 10 defines visual styling and supersedes the earlier muted design direction. Resolve a documentation mismatch against those authorities and record the correction; do not silently invent a second contract.

Read the root README, this file, then documents 01–06 and 08–10. Use `07-one-shot-build-prompt.md` to initiate the build. The earlier root build brief is a historical summary; these documents include the subsequent technology and visual-design decisions.

## User-confirmed decisions

| ID | Decision |
| --- | --- |
| D01 | Working product name: ClassCompass. A teacher-controlled planner connects student evidence to the next lesson and later progress. |
| D02 | Grade 5 math; addition of fractions with unlike denominators, excluding mixed numbers for the demonstration. |
| D03 | Known questions and worksheet layout, with clear handwritten submissions. General worksheet-layout recognition is outside the initial build. |
| D04 | Eight fictional students, four baseline questions. Three recurring denominator-addition cases, two secure cases, one handwriting-review case, one supported-correct case, one insufficient-work case. |
| D05 | Upload a prepared existing 45-minute lesson; change its 12-minute practice block to concurrent targeted, independent, and extension activities. |
| D06 | Include both correction of extracted handwriting and correction of classroom context such as help provided. |
| D07 | Allow review of individual answers and confirmation of shared patterns across selected students. |
| D08 | Show before/after lesson changes with reasons, evidence, and time. Teacher accepts selected changes, edits, or keeps the original. |
| D09 | Produce printable targeted practice, extension content, and two fresh follow-up questions. |
| D10 | Mixed follow-up results must change subsequent suggestions. Earlier work and support context stay accessible. |
| D11 | Complete one unit; preview wider-calendar effects while preserving objectives, teaching days, and fixed assessment dates. |
| D12 | Next.js with TypeScript provides the frontend and backend. Supabase provides PostgreSQL and private file storage. Tailwind CSS and shadcn/ui provide the UI foundation. |
| D13 | OpenRouter serves both models. `google/gemma-4-26b-a4b-it:free` transcribes images. `deepseek/deepseek-v4-flash-0731:free` interprets text evidence and drafts instruction. |
| D14 | Application code checks fraction arithmetic, lesson timing, references, and permissions. Models do not approve findings or mutate saved plans. |
| D15 | Four-person hackathon team; maximum five-minute submission video. Codex will implement the application from these documents when instructed. |
| D16 | Strongly reference Blooket's teacher-dashboard UI character: saturated sidebar, substantial rounded controls, friendly headings and colorful cards. ClassCompass uses original branding, artwork, copy and implementation; document 10 defines the visual contract. |

## Implementation defaults resolved for the one-shot build

These are explicit engineering/product defaults selected to finish the specification, not additional decisions attributed to the user.

| ID | Default and reason |
| --- | --- |
| I01 | One classroom and one pre-provisioned teacher account in connected mode. No signup, school administration, parent portal, or student login. |
| I02 | `DATA_BACKEND=local` and `AI_MODE=fixture` are the zero-credential defaults. The whole workflow must run and persist locally with a prominent fixture label. Connected and live modes must also be implemented. |
| I03 | Local storage is a JSON repository and file directory, restricted to a single locally running application. Hosted operation requires Supabase; never rely on a hosted function's filesystem for durable state. |
| I04 | Every teacher edit is version checked and recorded. Accepted lesson versions are immutable. A new proposal needs a separate apply action. |
| I05 | Pending findings may be inspected, but only confirmed evidence can support a proposed instructional change. Unknown help does not become independent performance. |
| I06 | Changes to the three concurrent practice lanes form one atomic change to the 12-minute block. Other changes, such as the exit prompt and follow-up checkpoint, can be accepted separately if dependencies and time constraints still hold. |
| I07 | Baseline evidence is dated September 22, next lesson September 23, follow-up September 24, and the following lesson September 25; fixed unit assessment October 2, 2026. Follow-up proposals target September 25 and preserve the taught September 23 version. The complete unit runs September 21–October 2. These are fictional teaching dates, distinct from hackathon dates. |
| I08 | Unit and year calendar views use the same saved schedule. The year view is a preview of authored later units and protected dates; no automatic year-wide rescheduling engine. |
| I09 | Clear PNG/JPEG worksheet scans and single-page worksheet PDFs are supported. PDFs are rendered locally to images. Lesson import supports the supplied text-based PDF layout and a documented JSON format. |
| I10 | Processing is resumable, with persistent progress and one bounded model call per job step. Keeping the page open advances steps; reopening lets the teacher resume. Background completion after closing the browser is not promised. |
| I11 | Use a fixed model ID for each stage, application validation, controlled retries, and saved extractions. Do not silently route to paid models or paid PDF/OCR plugins. |
| I12 | If genuine handwritten sample images are unavailable during the build, create clearly identified synthetic handwriting samples from the authored fixture. Do not claim these measure real children's handwriting recognition. |

## Essential scope and completion boundary

The build is complete when all of the following are implemented: upload/import, persisted source evidence, both review modes, both correction types, genuine proposal recomputation, selected application to a saved lesson, usable print layouts, unit/year preview, follow-up ingestion, and dated progress history. All visible navigation and action controls must work.

Credential-free fixture operation is a development and evaluation path. It does not replace the live OpenRouter/Supabase implementation. If credentials are unavailable, finish the adapters and configuration instructions, run all possible local checks, and identify connected checks that could not be exercised. Never call a fixture-only implementation live AI.

## Exclusions

- Arbitrary curricula, unknown worksheet layouts, mixed numbers, student ranking, permanent mastery labels, automated grades/report cards.
- School-wide permissions, LMS integrations, email, payment, collaboration editing, notifications, or external calendar synchronization.
- Training models, vector databases, agent orchestration frameworks, or a separate Python API.
- Changes to fixed dates or other students' pacing without an explicit teacher-approved proposal.

## Remaining external dependencies, not design questions

The exact live handwriting quality is unmeasured. Teacher participation is possible but unconfirmed. Implementation used the authenticated Supabase CLI to link a dedicated ClassCompass project, apply all migrations and provision the fictional teacher. Real database/Storage isolation and the connected HTTP workflow have passed. The user requested public publication, and implementation checkpoints are pushed to [RyanSXing/classcompass](https://github.com/RyanSXing/classcompass). Private OpenRouter/Supabase configuration and the generated teacher login remain outside Git. Live provider availability and quality checks are reported separately in [verification results](verification-results.md). Public hosting and submission publication remain separate actions; the working application is available locally.
