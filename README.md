# ClassCompass

**A teacher-controlled lesson planner that connects student work to what gets taught next.**

Public repository: [RyanSXing/classcompass](https://github.com/RyanSXing/classcompass).

This repository currently contains the complete implementation specification and fictional classroom content. **The app is not built yet.** The next task is to implement the full workflow from these documents, including a credential-free local demonstration and real OpenRouter/Supabase adapters.

The demonstration covers Grade 5 fraction addition: import a lesson, upload known worksheets, inspect and correct findings, approve specific lesson changes, print activities, preview the calendar, and use follow-up work to revise the next lesson. Original evidence stays beside each instructional decision.

## Start here

Use the [one-shot build prompt](docs/07-one-shot-build-prompt.md) for the implementation task. It tells the builder what to read, build, verify, and deliver without reopening settled architecture questions.

| Document | What it defines |
| --- | --- |
| [00 — Decisions and scope](docs/00-decisions-and-scope.md) | Confirmed decisions, resolved defaults, exclusions, authority and completion boundary |
| [01 — Product and UX](docs/01-product-and-ux.md) | Requirements, routes, screens, teacher actions, accessibility and recovery states |
| [02 — Architecture and operations](docs/02-architecture-and-operations.md) | Stack, source structure, storage/auth, uploads, processing jobs and deployment constraints |
| [03 — Data and API contracts](docs/03-data-and-api-contracts.md) | Entities, schemas, HTTP routes, reviews, revisions, atomic application and invariants |
| [04 — Demo and curriculum](docs/04-demo-and-curriculum.md) | Worksheet content, fictional students, teaching activities, asset specifications and 4:50 storyboard |
| [05 — AI contracts and prompts](docs/05-ai-contracts-and-prompts.md) | Model responsibilities, prompt templates, structured outputs, validation and fixture/live boundaries |
| [06 — Validation and delivery](docs/06-validation-and-delivery.md) | Build sequence, acceptance journeys, test matrix, print checks and submission deliverables |
| [07 — One-shot build prompt](docs/07-one-shot-build-prompt.md) | Copyable implementation instruction and definition of done |
| [08 — Sources and assumptions](docs/08-sources-and-assumptions.md) | Official documentation, hackathon requirements, volatile capabilities and unresolved external dependencies |
| [09 — Specification verification](docs/09-specification-verification.md) | Checks actually performed on these documents and fixtures; separate from future application tests |
| [10 — Visual design](docs/10-visual-design.md) | Blooket-inspired dashboard styling, original ClassCompass identity, design tokens and per-screen visual requirements |

Supporting inputs:

- [Machine-readable classroom fixture](docs/fixtures/classroom.json): eight fictional students, 32 baseline responses, 16 follow-up responses, two complete 45-minute lessons, ten teaching days, material prompts and answer keys.
- [Environment template](docs/examples/env.example): proposed application configuration, with no credentials.
- [Original build brief](ClassCompass-build-brief.md): historical product summary, superseded by the numbered specifications where later decisions differ.

## Selected implementation

Next.js App Router and TypeScript provide the frontend and backend. Tailwind and shadcn/ui provide the UI foundation. Supabase provides connected PostgreSQL, private file storage, and teacher authentication. OpenRouter serves Gemma for image transcription and DeepSeek for text analysis/planning. Deterministic application code checks fractions, references, timing, ownership, and approval state.

The UI strongly references Blooket's teacher-dashboard character: saturated violet sidebar, raised buttons, rounded headings and colorful cards, with original ClassCompass branding and assets. Evidence and lesson comparison panels retain clear, readable working surfaces.

Local mode persists the complete demonstration without credentials. Fixture analysis is prominently labeled and recomputes from teacher-edited evidence; live mode makes actual provider requests and never silently substitutes prepared outputs. The environment switches are `DATA_BACKEND=local|supabase` and `AI_MODE=fixture|live`.

## Implementation status

- Product, technical contracts, curriculum and verification requirements: specified.
- Worksheet images/PDFs, application code, migrations and automated application tests: to be created during implementation.
- Live handwriting quality, provider availability, connected storage/auth and deployment: not yet tested.
- Grade 5 teacher participation: possible, unconfirmed.

There is no `package.json` or runnable setup command yet. Document 06 defines the scripts the implementation must provide. Once built, replace this status section with verified setup/run instructions while retaining the specification links and honest integration status.
