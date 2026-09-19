# Data and API contracts

This document owns runtime names, states, and invariants. The authored JSON in `fixtures/classroom.json` is a seed/test input, not a database dump. Transform it explicitly into these contracts. Use Zod schemas as the implementation's shared source of types; never maintain separate divergent frontend and backend interfaces.

## Primitive types and boundaries

IDs are opaque strings, including the human-readable fixture IDs; do not require every ID to be a UUID. Generate new IDs on the server. Use ISO UTC timestamps for audit events and date-only `YYYY-MM-DD` strings for teaching dates. `revision` is a positive integer incremented atomically on an editable entity. JSON requests reject unknown fields at mutation boundaries.

```ts
type SupportLevel = 'independent' | 'supported' | 'unknown';
type EvidenceRef = { responseId: string; responseRevision: number };
type SupportContext = {
  level: SupportLevel;
  source: 'teacher-recorded' | 'teacher-corrected' | 'not-recorded';
  note: string;
};
type Rect = { x: number; y: number; width: number; height: number };
type Provenance = {
  mode: 'fixture' | 'live';
  modelId: string;
  promptVersion: string;
  generatedAt: string;
  inputFingerprint: string;
};
```

Rectangle values use normalized top-left coordinates in `[0,1]`; width/height are positive and right/bottom never exceed one. They come from a versioned template, not model output. `EvidenceRef` always points to the exact effective response revision seen when a decision was made. Support context is submission-wide for this prototype, explicitly shown as applying to every answer on that page. If assistance differed by question, the teacher records the qualification in the note; conservative independent-skill claims are blocked for the submission. Per-question support overrides can be added later.

Findings/observations spanning dates carry `supportSnapshots: {submissionId, submissionRevision, support: SupportContext}[]`, one per referenced submission. All referenced response and support revisions participate in freshness checks. Continuing extension may cite current follow-up plus prior confirmed baseline evidence, but support from the new task must never overwrite the earlier task's context. API fields use camelCase; relational columns use snake_case with explicit repository mapping.

## Persistence model

All owned rows carry `owner_id`, `created_at`, and an ID. Mutable rows also carry `updated_at` and `revision`. Scope all queries and foreign references to the authenticated owner/classroom. Use normalized relational tables for identities, evidence, and lifecycle states; bounded JSONB snapshots are appropriate for lesson blocks and AI payloads.

| Entity/table | Required fields and purpose |
| --- | --- |
| `classrooms` | Name, grade, subject, timezone, `evidence_revision`, `calendar_revision`. Revision counters invalidate derived work. |
| `students` | Classroom ID, fictional display name, active flag. No unnecessary personal information. |
| `units`, `objectives` | Date range, objective IDs, available teaching dates, locked assessment dates, prerequisite relationships. |
| `worksheet_templates`, `questions` | Immutable version, activity, objective/criterion IDs, prompt, difficulty, expected rational answer, question region. Baseline and follow-up have distinct IDs. |
| `assets` | Classroom/batch or import ID, original object key, normalized object key if relevant, SHA-256 hashes, MIME types, byte counts, dimensions/page count, `pending/ready/rejected`. Never store signed URLs as permanent identities. |
| `lesson_imports` | Source asset, parsed draft, validation errors, `draft/confirmed`, eventual lesson/version ID. |
| `batches` | Classroom, template, activity date, `baseline/followup`, mapped student submissions, source teaching plan version for follow-up, revision. Processing status comes from a job. |
| `submissions` | Batch/student/asset IDs, support context, revision, optional superseded submission ID. One active submission per student per batch. Replacements preserve originals. |
| `extractions` | Immutable raw extraction, provenance, asset hash, template version, response array. Do not overwrite on teacher edits. |
| `responses` | Submission/question IDs, extraction ID, effective `workingText`, `answerText`, `clear/uncertain/blank` legibility, deterministic math check, revision. Expose `readingStatus: unreviewed|resolved` derived from a review of this exact revision. |
| `reading_reviews` | Response ID/revision, actor/time, resolved reading and note. Append-only acknowledgement; does not change the text revision it acknowledges. |
| `response_revisions` | Append-only before/after effective response snapshots, teacher ID, reason, timestamp. Original extraction remains accessible. |
| `findings` | Student, objective, code, claim scope, explanation, exact evidence references, per-submission support snapshots, limitations, AI or teacher provenance, review state, teacher-edited explanation if any. |
| `observations` | Immutable snapshot from confirmed finding: date, task/template/difficulty, evidence, support, interpretation, review event. A later correction appends a superseding observation rather than deleting history. |
| `lesson_plans` | Unit, date, title, `current_version_id`, revision. Include September 23 and September 25 plans. |
| `plan_versions` | Immutable `LessonSnapshot`, version number, previous version, applied proposal and selected change IDs, evidence snapshot, actor/time. |
| `proposals` | Target lesson, base plan version, evidence/calendar revision, input fingerprint, draft changes, teacher edits, revision, status. |
| `material_sets` | Immutable structured printable content tied to an accepted plan version; question IDs, prompts, rational operands/keys, scaffolds and teacher notes. |
| `calendar_entries` | Unit/date, linked lesson/version, kind, duration/containing block, objective IDs, prerequisite IDs, locked flag. Preserve authored planned events separately from proposed overlays. |
| `jobs`, `job_steps` | Type, entity IDs, input fingerprint, status, attempt/lease/retry fields, bounded errors, completed output references. |
| `audit_events`, `mutation_keys` | Append-only actor/action/entity/revisions; owner+operation+idempotency key+request hash+result identity for safe retries. |

Required database constraints: unique `(batch_id, student_id)` for active submissions; unique `(submission_id, question_id)` for effective responses; unique `(lesson_id, version_number)`; unique `(owner_id, operation, key)` for mutation keys; valid enumerations and positive revisions; foreign keys for ownership-consistent references. Cross-owner references must fail even when IDs exist. Add indexes on classroom/date, batch/student, finding status, job status/next-attempt time, and lesson/version.

Apply RLS to every owned table and private storage objects. Ordinary operations use the signed-in user's database role. Atomic review, job claims, correction invalidation, and proposal application use transactional database functions with explicit owner checks, fixed search paths, and narrowly granted execution. Prefer `security invoker`; do not bypass RLS to make an API work. Local repository methods perform the same transactions in one locked store commit.

## Mathematical checks and findings

Parse explicit simple integer fractions from effective answers without evaluating code. Keep displayed transcription unchanged. Normalize sign and reduce with integer GCD; compare exact rational values by integer cross multiplication. Accept equivalent unreduced fractions and valid nonleast common denominators. Bound parser integers to safe values (absolute value at most 10,000); denominator zero and mixed-number syntax are unsupported. Missing or unparseable work is `unresolved`, never automatically incorrect. Match optional units separately from numeric value.

`MathCheck` contains `status: correct|incorrect|unresolved|blank`, parsed final fraction if present, expected fraction, `unitStatus: correct|missing|not_required|unresolved`, and contradictions between parseable intermediate/final equalities. An inconsistent written chain is a reason for review; code cannot decide whether the student or transcription is wrong. Free-form reasoning remains a teacher-reviewed interpretation.

Finding codes are `denominator_addition`, `equivalent_fraction_reasoning`, `correct_with_support`, `needs_independent_check`, `ambiguous_transcription`, `insufficient_evidence`, and `other_teacher_finding`. A finding includes `claimScope: mathematics|independent_performance|evidence_quality` and `observationStatus: independent|supported|not_demonstrated|insufficient|unknown_support`. Do not manufacture a percentage mastery score.

For this demo, use these transparent suggestion rules, not universal assessment cutoffs:

- A repeated denominator-addition candidate requires at least two distinct clear responses whose working supports that operation. One wrong final answer alone is insufficient.
- A new extension candidate requires at least three reviewed correct responses with equivalent-fraction reasoning, recorded independent conditions, and no unresolved contradictory response in that batch. Continuing an existing extension placement after the two-question follow-up may cite unsuperseded confirmed baseline evidence plus both new independent responses; it does not require a third follow-up question. Every placement remains teacher-reviewed.
- Correct supported work records supported evidence and proposes a brief independent check. Unknown support cannot establish independent performance.
- Blank/incomplete work prompts more evidence; it does not establish a misconception.
- Two fresh correct independent follow-up responses with reviewed reasoning support returning to planned application. A repeated error supports continued targeted review. One response plus a blank preserves that one observation and requests the missing evidence.

UI groups are projections over per-student findings. They are not authoritative group-level labels. The service computes eligible suggestions from current evidence and confirmed findings; model prose cannot override these gates.

## Review and invalidation

Finding states are `candidate → confirmed|rejected`; `confirmed → stale` when its dependent evidence or context changes. A teacher may reopen a rejected finding as a new candidate revision. An AI re-run creates new candidate revisions and never overwrites teacher-confirmed content automatically.

Edit interpretation changes meaning as well as wording. A bounded teacher override may revise code, claim scope, explanation, limitations, suggested next step, objective and evidence references. Preserve the original AI version; save a new teacher-authored candidate revision, recompute eligibility, and require explicit confirmation. A teacher may also create an `other_teacher_finding` tied to existing responses. Overrides cannot manufacture evidence, override structured arithmetic checks, or turn unknown help into an independent-performance state; the teacher corrects the underlying transcription/context first when needed. Free-text instructional interpretation remains teacher judgment. Model provenance is nullable for wholly teacher-authored findings, which instead record actor/time and source `teacher`.

`Confirm` verifies evidence ownership/revisions, reading resolution for definitive answer claims, and support eligibility for independence claims. A teacher can confirm `insufficient_evidence` or unresolved context as a limitation without inventing an affirmative skill observation. Pattern confirmation submits the explicit selected finding IDs and expected revisions. Apply the selection atomically: a version conflict returns 409 and changes none of the selected findings. Show ineligible selections before submitting; server validation is authoritative.

Confirmation explicitly acknowledges the clear source readings shown on the selected cards and atomically appends `reading_reviews` for their current response revisions. This does not increment or silently change the referenced text revision. It permits group review without 32 separate transcription-save actions. Uncertain or contradictory readings cannot be cleared by that acknowledgement: the teacher must resolve/accept the specific reading through the response editor first, even if no characters change. Show these ineligible records before batch confirmation. Confirmation evaluates suggestion gates against the resulting reviewed state. A text/legibility edit creates a new response revision and may explicitly review that new revision in the same correction transaction; reviews of old revisions do not carry over automatically.

Saving a transcription or support correction atomically appends an audit/revision event, increments affected response/submission and classroom evidence revisions, refreshes deterministic math, marks dependent findings stale, and marks pending dependent proposals stale. Unrelated confirmed findings stay confirmed. Existing observations remain in history with a superseded/needs-review marker. Reconfirmation creates the revised observation. Never replace original scans or accepted plan versions.

Confirming/rejecting/revising a finding also increments the classroom evidence revision and invalidates derived draft proposals. Because a full-class placement considers every active student's coverage, all pending proposals in this classroom conservatively depend on its evidence revision. The UI computes freshness against that revision even if no background task has updated a status label. Idempotent repeated confirmation creates no duplicate observation. Generated candidates alone are not confirmed observations.

Rejecting or semantically overriding a previously confirmed finding marks its old observation superseded/withdrawn as part of the same transaction. History retains that observation and reason; current summaries cannot keep presenting withdrawn meaning as active evidence. A later confirmation appends a replacement observation. Wording-only edits still retain attribution and revision history.

Baseline and follow-up are separate submissions on separate dates. Follow-up suggestions target `lesson-2026-09-25`; they do not retcon the already-taught `lesson-2026-09-23`.

## Lessons, proposal operations, and application

```ts
type LessonSnapshot = {
  schemaVersion: 1;
  lessonId: string;
  unitId: string;
  date: string;
  title: string;
  objectiveIds: string[];
  totalMinutes: 45;
  blocks: LessonBlock[];
};
type LessonBlock = {
  id: string; title: string; minutes: number; instructions: string;
  mode: 'whole_class' | 'concurrent';
  lanes?: {
    id: string; title: string; studentIds: string[]; teacherLed: boolean;
    minutes: number; instructions: string; materialIds: string[];
    entryCheckStudentIds: string[];
  }[];
};
```

Seed/import the five stable block IDs `warmup`, `model`, `practice`, `application`, `exit`, durations 5, 8, 12, 15, 5. The JSON seed's `content` maps to runtime `instructions`; the original blocks use `whole_class`. Import JSON uses this runtime schema, not the seed file's enclosing object. Generate a downloadable import example during the build.

Proposal changes use a discriminated operation:

- `replace_practice`: replace the known practice block with exactly three concurrent lanes (targeted, independent application, extension). The lanes occupy the same 12 minutes. Every active roster student occurs once, at most one lane is teacher-led, and entry-check students belong to their lane. Empty lanes may remain visibly unused; students with no confirmed skill evidence receive a neutral continue-and-gather-evidence placement, not an invented skill claim.
- `replace_exit`: change the five-minute exit content/material while preserving its duration.
- `schedule_checkpoint`: attach a follow-up/revisit within an existing future lesson/block. Specify containing calendar entry, offset and duration; do not add minutes to an already full day. Baseline follow-up uses 8 minutes at the start of September 24's 45-minute entry, leaving 37 minutes for its planned teaching.

Every change has server-generated ID, rationale, confirmed finding IDs, source evidence references, affected students, dependency change IDs, and structured payload. The three practice lanes form one selectable change. Exit/checkpoint changes can be selected independently unless explicit material or instructional dependencies require another selected change. A material referenced only by a rejected change is not published as accepted instruction.

Proposal statuses: `draft`, `stale`, `applied`, `discarded`. Edits require `expectedRevision`, preserve AI source alongside teacher edits, and rerun validation. Refresh creates a new draft; retain the prior draft in history and require the teacher to resolve whether edited text is carried forward. A stale draft cannot be applied.

Application must be one atomic transaction:

1. Check actor ownership, idempotency key/request hash, proposal revision/status, expected current plan version, and exact evidence/calendar fingerprints.
2. Resolve selected change IDs; validate dependencies, all evidence still confirmed, exact roster coverage, durations, required objectives, teaching dates, prerequisites and locked dates. A practice block counts 12 minutes, not the sum of its lane durations. Block/lesson totals and calendar coverage must remain valid.
3. Build the full resulting snapshot and material set. Any invented reference or invalid generated math rejects the application with actionable validation details.
4. Insert one new immutable plan version, its materials and accepted calendar updates; move the current plan pointer; mark the proposal applied; write audit/idempotency results.
5. Return the version/material/calendar identities. Repeating the same request/key returns the same result; a different body with the same key returns 409. No duplicate versions or half-applied calendars.

Unselected changes remain visible as unselected in the applied proposal's history. They cannot later be applied against its old base; propose again from the new current version. Selecting zero changes leaves the original plan untouched and is handled as Keep original/Discard proposal.

## HTTP surface

All routes live in Node-runtime Next.js handlers. Pages may call the same server services directly. JSON bodies are bounded to 256 KiB, except the documented local streaming file route. Authorize every record reference. Mutations check origin, session, input schema, revision, and idempotency where noted. Client identity/owner fields are never authoritative.

| Method and route | Contract |
| --- | --- |
| `GET /api/classroom` | Roster, active unit, lesson summaries, current modes, pending jobs; no keys or answer-key payload for image extraction. |
| `POST /api/uploads/prepare` | `{purpose, templateId?, files:[{name,type,size,studentId?}]}`; returns asset IDs, server object keys, authorized upload instructions. Idempotent. |
| `PUT /api/uploads/:assetId/content` | Local-only bounded streamed bytes; connected clients use signed storage uploads. Separate original/normalized slots allocated by prepare. |
| `POST /api/uploads/:assetId/complete` | Finalize original/normalized metadata; server verifies stored files, hashes/type/size, ownership. Ready only after validation. |
| `GET /api/assets/:assetId` | Authorized preview descriptor/signed URL or local content; no arbitrary external URL proxy. |
| `POST /api/lesson-imports` | Ready source asset plus extracted draft text or runtime JSON; returns parsed editable preview and validation. |
| `POST /api/lesson-imports/:id/confirm` | `{expectedRevision, lesson: LessonSnapshot, expectedPlanVersionId?}`; creates the first version, or a new version only if the supplied current version matches an existing lesson. Otherwise an ID collision returns 409. Preserve source attribution and earlier versions; validate before saving. |
| `POST /api/batches` | Template, activity date, mapped ready assets/student IDs and support context; optional previous batch/teaching version. Idempotent. |
| `GET /api/batches/:id` | Submissions, effective responses, original extraction references, findings and job progress. |
| `POST /api/batches/:id/analyze` | `{expectedRevision}` plus idempotency key; returns 202 with job ID. Reuses valid extraction cache; analyzes effective corrections. |
| `GET /api/jobs/:id` | Status, completed/total steps, retry eligibility, safe errors; never dispatches a model call. |
| `POST /api/jobs/:id/run-next` | Claims one eligible step, returns updated job/progress or wait reason. Duplicate concurrent requests cannot commit the same output. |
| `POST /api/jobs/:id/cancel` | Cancels further dispatch and invalidates outstanding leases. |
| `PATCH /api/responses/:id` | `{expectedRevision, workingText, answerText, legibility, readingStatus, reason}`; append correction and invalidate dependencies. |
| `PATCH /api/submissions/:id/support` | `{expectedRevision, support, reason}`; record actual assistance, preserve correct arithmetic. |
| `POST /api/findings/review` | `{items:[{findingId,expectedRevision,decision}],acknowledgeClearReadings,reason?}` where decision is confirm/reject; atomic selected review. Interpretation edits use the separate revision route. |
| `POST /api/findings` | Create a teacher-authored candidate with student/objective IDs, code, claim scope, explanation, evidence references and limitations; validate support/arithmetic and record actor. |
| `PATCH /api/findings/:id` | Expected revision, bounded semantic override fields, reason; preserve original version, return to candidate, recompute eligibility and invalidate proposals. Confirm separately. |
| `POST /api/plans/:lessonId/proposals` | `{basePlanVersionId,expectedEvidenceRevision,expectedCalendarRevision}`; 202 plan job using only confirmed evidence plus explicit uncertainty. |
| `GET /api/proposals/:id` | Draft, before/after computed result, validation, freshness and evidence links. |
| `PATCH /api/proposals/:id` | Expected revision and bounded known change edits; no arbitrary JSON Patch or owner/status overrides. |
| `POST /api/proposals/:id/apply` | Expected revisions/base plus selected IDs and idempotency key; returns accepted version and materials. |
| `GET /api/calendar` | Authored accepted calendar plus separately labeled selected proposal overlay; optional unit/year view. |
| `GET /api/students/:id/progress` | Dated observation history, source context, superseded markers, current suggestions. |
| `GET /api/materials/:planVersionId` | Accepted content and print options, independent of latest draft. |
| `POST /api/demo/reset` | Local fixture mode only, explicit UI confirmation; reset generated fictional state and files, preserve authored source fixtures. Connected seed/reset is a deliberate CLI operation, not a public endpoint. |

Example application body (idempotency key in `Idempotency-Key` header):

```json
{
  "expectedRevision": 2,
  "basePlanVersionId": "plan-version-original",
  "expectedEvidenceRevision": 18,
  "expectedCalendarRevision": 1,
  "selectedChangeIds": ["change-practice", "change-checkpoint"]
}
```

Successful JSON reads use `{data: ...}`; accepted jobs return `{data:{jobId,status:"queued"}}`. Errors use `{error:{code,message,fieldErrors?,retryAfterSeconds?,requestId}}`. Use 401 unauthenticated, 404 inaccessible/missing record, 409 revision/state conflict, 413 limits, 415 unsupported media, 422 domain/schema invalid, 429 retry/rate gate, 503 provider unavailable. Never include raw provider credentials or full scans in errors.

## Job state contract

Jobs are `queued|running|waiting_retry|blocked|completed|failed|cancelled`; steps are `pending|running|waiting_retry|completed|failed|cancelled`. Persist attempt count, last error, next attempt time, lease token/expiry, and fingerprint. `blocked` requires explicit retry after quota/configuration recovery; exhausting three attempts yields failed. Retry reopens failed steps explicitly and retains successful outputs, subject to a new user-triggered attempt budget. Completed extraction steps remain inspectable on a partly failed batch. Do not produce a complete batch analysis until all selected submissions are extracted; teachers may intentionally remove a failed submission by creating a new partial batch revision, with missing coverage shown.

Claims are atomic and teacher-wide dispatch-gated. Completion must compare the lease token and fingerprint in the same transaction as output writes. Expired/stale/cancelled results cannot update responses or plans. An edit during a job leaves teacher changes intact, marks the old generation stale, and requires a fresh job over current inputs. Provider output is data, never a command to mutate unrelated records.
