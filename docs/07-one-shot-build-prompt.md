# One-shot implementation prompt

Copy the prompt below into the implementation task in this workspace. This file authorizes the application build only when the user invokes it; writing the specification has not started that build.

---

Build the complete ClassCompass application in this workspace using the existing specification. You are the builder. Carry the implementation through a working, tested, polished local product; do not stop after scaffolding, a plan, static screens, or one happy-path mockup.

First read `README.md`, `docs/00-decisions-and-scope.md`, and all numbered documents 01–06 and 08–10. Read `docs/fixtures/classroom.json` and `docs/examples/env.example`. The latest user instruction has priority; within the docs, 00 owns scope, 03 owns runtime contracts, 04 plus the fixture own teaching content, 01 owns UX behavior, and 10 owns visual styling. Respect applicable workspace instructions and use current official documentation/Context7 for framework and API implementation. Preserve the agreed architecture unless a concrete incompatibility requires a documented change.

The product is a teacher-controlled planner for Grade 5 fraction addition with unlike denominators. Its complete loop is upload student work → inspect/correct findings → propose changes → apply selected changes → teach → upload follow-up → revise the next lesson. The central workspace puts original student evidence beside the before/after instructional change.

Implement the selected stack: Next.js App Router + TypeScript for UI and Node backend; Tailwind CSS + shadcn/ui; Zod contracts; Supabase Postgres/private Storage/Auth; native server-side OpenRouter transport; HTML/SVG print layouts. Use compatible stable package versions and commit a lockfile. No separate FastAPI service, vector database, orchestration framework, or new product integrations are needed.

Implement both repository adapters and both provider modes. Default local/fixture mode must run without external credentials and persist the entire workflow. Keep a prominent fictional-data and fixture-analysis label. Implement the genuine Supabase and OpenRouter paths with validated configuration and server-only secrets; unavailable credentials should prevent only the external checks, not local completion. Do not silently downgrade live failures to fixture results or switch to paid models.

Use the exact configured endpoints unless the user changes them:

- `google/gemma-4-26b-a4b-it:free` for handwriting extraction from normalized worksheet images.
- `deepseek/deepseek-v4-flash-0731:free` for text-only candidate findings and proposed instruction.

Verify current endpoint capabilities before implementation smoke tests. Respect the distinct structured-output capabilities in document 05. Code checks arithmetic, reference integrity, source revisions, assistance eligibility, roster coverage, lesson duration, prerequisites and locked dates; models do not approve evidence or write saved plans.

Create the authored assets as part of the build: two blank worksheet templates, eight baseline scans, eight follow-up scans, lesson import PDF/JSON, and material print views/teacher keys. If actual handwritten scans are absent, produce clearly labeled synthetic handwriting samples from the reference transcripts, with a reproducible generator and documented font/source. Use suitable installed generation tools and visually inspect the result. Keep the registered question regions accurate. Do not claim synthetic fixtures establish real-child OCR quality.

Build the complete routes and interactions specified in document 01: classroom, evidence review, lesson comparison, calendar, student progress, materials, and connected login/logout. Every visible action must work. Import the lesson through a real preview/confirmation path; retain original worksheet bytes and normalized images; map each page to the selected student/template; handle invalid/partial uploads visibly.

Implement real teacher review and correction semantics. Both individual and selected-pattern review use the same records. Transcription edits, support-context edits, and semantic interpretation edits preserve original evidence and history, recalculate eligibility, and invalidate dependent drafts. Only confirmed findings justify instructional changes. A separate Apply selected changes transaction creates an immutable accepted lesson version and its materials/calendar effects. Handle stale versions and duplicate requests correctly.

Use all 48 authored responses and their documented cases. After baseline review, the proposal should be explainable from current evidence: targeted practice for the recurring denominator pattern; independent checks when support or missing work limits the evidence; extension when the reviewed work supports it. These are test expectations, not runtime assignments by student name. Fixture mode must recompute from effective corrections rather than replay fixed final outcomes. Keep hidden reference transcripts and expected groups outside live model payloads.

Keep the original lesson at 45 minutes, with blocks 5+8+12+15+5. The three practice lanes are concurrent within one 12-minute block and cover all eight students exactly once. Apply that block atomically; allow separate compatible exit/checkpoint changes. Preserve the October 2 assessment and the next-unit dates. Show proposed calendar overlays separately from accepted events.

Demonstrate the prepared Finley transcription correction honestly and Gray's assistance correction independently. Follow-up creates new dated observations: accept Blake's unreduced `3/6 meter`, let changed evidence alter next-step suggestions, preserve Harper's valid response without labeling the blank a misconception, and retain Gray's supported baseline alongside new independent work. Follow-up proposals target the authored September 25 lesson; never overwrite the September 23 lesson already taught.

Implement resumable persisted jobs with one external call per step, atomic claims/leases, bounded retries, dispatch gating and caching. Closing or navigating away may pause dispatch; reopening resumes. No fire-and-forget promise should pretend to be a durable worker. Late or stale output cannot overwrite teacher corrections or accepted plans.

Deliver the strongly Blooket-inspired teacher workspace specified in document 10: saturated violet sidebar, prominent raised buttons, rounded heavy headings, colorful classroom cards, and friendly large controls. Create original ClassCompass branding, copy and graphics; do not import Blooket's logo, characters, source/CSS or artwork. Keep the evidence/review and before/after workspaces readable on white surfaces and preserve document 01's behavior. Include accessible focus/status, useful empty/loading/error states, clear fraction notation, original-scan zoom, visible provenance, and usable Letter/A4 print layouts. Keep student printouts separate from teacher answer keys. The muted visual direction from the initial draft is superseded.

Work in coherent vertical slices and use bounded parallel tasks where helpful, with clear file ownership. Resolve routine implementation choices using the specification. Do not reopen settled product questions; record reasonable implementation choices. If a real external blocker appears, complete everything independent of it and state exactly what remains unverified.

Provide the scripts required by document 06: `fixtures:validate`, `assets:generate`, `demo:seed`, `demo:reset`, `lint`, `typecheck`, `test`, `test:e2e`, `verify`, `test:live`, `test:supabase`, plus normal `dev/build/start`. Keep destructive reset operations limited to the explicitly selected fictional test store. Create migrations, ownership policies, seed/provisioning instructions, `.env.example`, and ignored local/secret paths.

Run fixture validation, lint, type checking, meaningful domain/service tests, the production build, and the full local browser acceptance journey. Verify both correction types, interpretation edits, before/after selection/application, print output, calendar constraints, mixed follow-up, immutable history, conflict/idempotency handling and restart persistence. Inspect rendered screens/print layouts and fix defects. Run connected/live suites only when configured, and label unavailable tests not run rather than passed. Test adapters with deterministic mocks even when live credentials are absent.

Finish with a runnable README, exact setup/mode instructions, verified test results, generated asset manifest, architecture diagram, troubleshooting notes, and the specified demo storyboard/five-slide outline. Update documentation where implementation legitimately resolves a detail; do not rewrite the agreed scope to excuse missing functionality. Prepare local deliverables; publishing, making a repository public, submitting the hackathon entry, and deployment are separate actions unless the user requests them.

In your final response, give the local URL/run command, key completed behavior, test results, and any specific external integration that remains unverified. The completion standard is the full teacher-controlled loop operating locally with real persistence and complete live/connected adapters—not a collection of prepared screens.

---

For a shorter invocation once this document is in context: **“Implement ClassCompass completely from `docs/07-one-shot-build-prompt.md`. Build and verify the whole local workflow, with the documented live and Supabase adapters.”**
