# ClassCompass: product and experience specification

Status: implementation contract for the hackathon prototype. This specifies behavior to build; it does not claim that model quality, teacher validation, or user testing has been completed. Read alongside the project documentation index and the curriculum, architecture, AI, and verification specifications.

## 1. Product promise and scope

ClassCompass helps a teacher answer: **What should I teach next, who needs support, and what should change in my existing lesson?** Its main experience places student evidence beside the instructional decision it supports.

The agreed loop is **Upload work → Review findings → Adjust instruction → Teach → Check progress**. Build one coherent Grade 5 fraction-addition unit, excluding mixed numbers. The baseline contains eight fictional students completing four known questions. The next lesson lasts 45 minutes; the proposed differentiation replaces one 12-minute practice block with simultaneous activities. Follow-up contains two fresh questions with mixed results.

Teacher authority is fundamental. AI outputs are suggestions; confirmation of evidence and application of lesson changes are separate decisions. Previous observations and accepted lesson versions remain inspectable.

### Confirmed requirements versus implementation defaults

Confirmed requirements are the classroom, subject, known handwritten worksheet, both review modes, both correction types, before/after lesson comparison, selected-change approval, printable activities, constrained calendar preview, and mixed follow-up described above. The selected stack is Next.js/TypeScript, Supabase, and OpenRouter, with separate handwriting extraction and instructional reasoning models.

The following are documented implementation defaults, selected to make the build unambiguous:

- One teacher and one fictional classroom. No student login or multischool management.
- Unit dates September 21–October 2, 2026; baseline September 22; next lesson September 23; independent follow-up September 24; subsequent lesson September 25; fixed assessment October 2. These are fictional instructional dates.
- `DATA_BACKEND=local|supabase` and `AI_MODE=fixture|live` are independent configuration axes. Local/fixture must run without external credentials. Cloud operation requires Supabase Auth and a preprovisioned teacher account.
- Desktop-first teacher workspace with usable mobile review and print views.
- No arbitrary worksheet design, messaging, gradebook export, automatic year rescheduling, or unsupervised lesson application.

## 2. Traceable product requirements

| ID | Required behavior and completion signal |
| --- | --- |
| P01 | Upload the prepared lesson and known worksheet scans; every response links to its student, question, objective, criteria, source page, and relevant image region. |
| P02 | Show dates, task difficulty, and recorded help with observations. Correct work never implies independent performance by itself. |
| P03 | Aggregate per-student findings into pattern cards without losing individual evidence. Support selected-student batch confirmation and individual confirmation. |
| P04 | Keep uncertain handwriting, missing work, and missing support context distinct. Do not present an unresolved reading as a confirmed error or missing work as a misconception. |
| P05 | Allow transcription, interpretation, and support corrections. Preserve original values and scans; recheck dependent results and invalidate affected confirmations/proposals. |
| P06 | Use teacher-approved evidence to propose changes; explain what changes, why, for whom, the evidence, and lesson time. |
| P07 | Apply selected valid changes only through an explicit teacher action. Accepted versions are immutable history; later changes create another version. |
| P08 | Keep the lesson at 45 minutes. Different groups work concurrently inside the same 12-minute block; provide a feasible activity for every student. |
| P09 | Provide printable targeted practice, extension, and two follow-up questions tied to an accepted plan version, with teacher answer guidance separate from student pages. |
| P10 | Preview unit and wider-calendar consequences while preserving required objectives, teaching days, and the fixed assessment. Targeted support does not automatically delay everyone. |
| P11 | Append follow-up observations and show differentiated next recommendations. Retain earlier evidence; never assign permanent mastery from one worksheet. |
| P12 | Clearly label fictional student data, fixture/live analysis, pending review, stale proposals, failures, and saved state. Never substitute fixture success for a failed live request silently. |

## 3. Information architecture

Use a persistent desktop sidebar containing Classroom, Lesson plan, and Calendar. Evidence review is entered from a batch; student and material pages are contextual destinations. Show a breadcrumb and descriptive page title on every detail page. The sidebar highlights the parent destination. `/` redirects to `/classroom`.

| Route | Purpose and primary action |
| --- | --- |
| `/classroom` | Overview, upload intake, baseline/follow-up batches, and current planning status. Primary action follows the next incomplete step. |
| `/review/[batchId]` | Pattern and individual evidence review. Primary action: confirm selected eligible findings. |
| `/plans/[lessonId]` | Saved lesson beside proposed changes and linked evidence. Primary action: Apply selected changes. |
| `/calendar` | Accepted unit schedule with optional proposal overlay and wider-calendar context. |
| `/students/[studentId]` | Dated observations for the fraction-addition objective and supporting work. |
| `/materials/[planVersionId]` | Accepted-version printables and teacher guidance. Primary action: Print / Save PDF. |
| `/login` | Cloud teacher sign-in. Local mode enters the fictional classroom without authentication setup. |

The top bar displays classroom name, **Fictional student data**, and **Fixture analysis** or **Live analysis**. A compact details popover identifies data backend and analysis provider/model. Individual batches retain their own provenance even when the deployment configuration changes. A fixture badge explains that results are prepared demonstration outputs, not current model analysis.

## 4. Classroom and upload experience

The overview opens with the next useful task, not a wall of metrics. Below it place three compact counters: work received, findings awaiting review, and lesson changes awaiting a decision. Counters link to the corresponding list; they never imply student proficiency.

Show the current lesson card with its date, objective, 45-minute duration, version, and review/proposal status. The batch list identifies baseline or follow-up, submission count, date, analysis status, and an Open review action. The fictional roster links to student histories.

The upload entry point offers separate **Lesson import** and **Student work** panels. Lesson import previews the source, exposes parsed title/date/objective/block fields for editing, validates the 45-minute total, and saves only after Confirm import. Unsupported lesson layouts offer manual entry alongside the original preview.

Use this guided flow for student work:

1. Choose the known baseline or follow-up assignment; display its questions, objective, and criteria.
2. Add worksheet files in the supported formats defined by the input contract. Show a preview, file validation, and page count before processing.
3. Map worksheet submissions to the existing fictional roster. Show task date and support context; allow assignment-level defaults with per-student overrides. Do not silently mark work independent.
4. Display the final mapping, then Analyze work. Preserve the intake state if an analysis attempt fails.

Recognized assignment metadata is prefilled but inspectable. Duplicate student/assignment submissions require an explicit replace-as-new-revision decision; never overwrite history invisibly. A partial upload remains usable with missing students clearly identified. A demo-data entry point may load the prepared files, but uses the same review and plan flows and visibly identifies fixture analysis when selected.

## 5. Evidence review workspace

At 1280×800, preserve comfortable working space below the header. Use two main panes: original evidence on the left and interpretation/actions on the right. Above them, place a compact student selector, question selector, and Pattern / Individual tabs. Scans support zoom, fit-to-width, and opening the full page; highlighted question regions retain access to the unmodified original.

The pattern tab lists groups such as a recurring denominator-addition error, evidence supporting extension, and work needing clarification. Selecting a pattern shows contributing student answers, exact question references, and individual checkboxes. A pattern is a view over individual findings, not a separate authoritative assessment.

Each review card includes:

- Original image region and transcription, with an Edit transcription action.
- Mathematical check and reasoning interpretation as separate fields.
- Recorded support context and evidence limitations.
- Suggested finding, short rationale, and review status.
- Confirm, Edit interpretation, or Dismiss finding actions.

Batch confirmation applies the displayed finding to selected eligible records. Show the count and names before the action. Ambiguous readings block definitive answer-based claims until resolved; unknown assistance blocks claims of independence. Teachers may explicitly confirm that evidence is insufficient or that support context is unknown. Such confirmations do not become affirmative skill evidence. Explain each ineligible checkbox inline and allow review of the other selected students.

The individual tab exposes the same records and controls; switching tabs preserves selection and saved edits. Corrections save explicitly with a short reason or context note, retain the original value, and refresh the mathematical check. If the correction affects an already confirmed finding, mark it Needs reconfirmation. Other students' confirmations remain intact.

The handwriting correction and classroom-context correction use different students. Recording help leaves a correct answer mathematically correct but changes what it supports about independent performance. For the recorded demo, use an actual observed extraction error or a visibly labeled prepared correction example.

Show a compact Next lesson impact panel linking to the affected proposal. Corrections invalidate dependent proposals immediately; they do not rewrite an accepted lesson. Offer Review changed evidence and then Refresh proposal when the required confirmations are complete.

## 6. Lesson decision workspace

The lesson page is the central product screen. Its top row shows lesson date, objective, saved version, total time, and proposal freshness. A timeline summarizes all lesson blocks. The main split view pairs evidence with an expanded before/after change card; a teacher can move between changes without losing the associated source image.

Every change card presents original content, proposed content, affected students, rationale, supporting confirmed observations, time allocation, and editable instructions. Provide a selection checkbox, Edit, and Keep original. Keeping the original clears selection for that change. Selection is not approval.

Display the three activity lanes beneath a single **12-minute concurrent practice block** heading. Teacher-led fraction-model practice, independent application, and extension occur at the same time. Students needing clarification or an independent check must have an explicit safe activity placement and check-in instruction; never disappear from the roster or become an invented fourth teacher-led group. Show group rationale without labeling students as permanently high or low ability.

The block replacement is an atomic schedulable change. Teachers can edit its lanes and membership, but cannot apply only a fragment that leaves students unassigned or implies multiple teacher-led groups at once. Other independent changes, if present, are selectable separately. Any dependency is visible beside the checkbox.

A sticky footer shows selected change count, resulting total duration, and Apply selected changes. Disable application for stale evidence, invalid timing, missing placements, or violated calendar constraints, with a direct explanation and repair action. A successful application shows the new saved version and links to Materials and Calendar. Do not require an extra confirmation modal for this already explicit approval action.

Teacher edits to proposed content become part of the proposal and are preserved across navigation. Refreshing a stale proposal must warn before replacing teacher-edited draft text. Accepted versions remain available through a version selector; history is read-only, and a later revision starts from the current saved version.

## 7. Materials, calendar, and progress

Materials show the accepted version, target objective, suggested duration, and appropriate group. Use tabs for targeted activity, extension, follow-up, and teacher guidance. Student printouts omit app chrome, diagnostic labels, AI-analysis commentary, and answer keys; the approved instructional content remains. Provide sufficient handwriting space and legible fraction notation. Print preview supports ordinary browser printing and Save PDF. If newer evidence makes the source plan outdated, warn and link to the new proposal while retaining access to the historical materials.

Calendar defaults to the unit, with September 23 targeted instruction, September 24 follow-up, and October 2 assessment clearly distinguished. A wider view shows surrounding scheduled units as context. Accepted events are solid; proposed events are visibly marked Preview. Selecting an event opens its lesson/evidence context. Show proposed changes and constraints in a side panel. The assessment is visibly fixed. No calendar drag-and-drop is required; teachers adjust proposal fields and validate before application. If no new whole-class event is needed, say the broader sequence remains on schedule and show where targeted support fits.

Student pages use a chronological evidence list: date, assignment, difficulty, support, mathematical finding, teacher review state, original work link, and current next-step suggestion. Distinguish **Demonstrated independently**, **Demonstrated with support**, **Not yet demonstrated in this work**, and **Not enough evidence**. These describe observations, not permanent student attributes. Follow-up adds another dated row and can recommend continued support for one student while returning others to the planned activity. Empty history says what work is needed next; avoid numerical mastery percentages.

After reviewing the September 24 follow-up, the primary planning action is **Adjust September 25 lesson**, targeting the authored `lesson-2026-09-25`. Show September 23 as the completed instructional context. Follow-up recommendations never rewrite that taught lesson; its plan and materials remain historical records.

## 8. State, resilience, and accessibility

| State | Required presentation and recovery |
| --- | --- |
| Empty | Explain the missing input and provide Upload work or Load fictional sample. Do not show fabricated insights. |
| Processing | Show truthful stages such as Uploading, Reading responses, Checking answers, and Preparing findings. Use indeterminate progress unless completion is measurable; retain page navigation and expose Cancel processing. Explain that keeping the review page open advances remaining steps. |
| Paused/cancelled | Navigating away pauses further browser-driven dispatch; reopening offers Resume from persisted progress. Cancellation stops new steps and ignores late results; it does not erase uploaded work or completed evidence. |
| Partial failure | Identify affected files/responses; preserve successful records and offer retry of failed work. No automatic duplicate observations. |
| Rate limit/provider failure | Explain that analysis has not completed, retain inputs, and expose Retry when available. Never display fixture results as live output. |
| Invalid/unsupported upload | Name the offending file and supported requirements; leave other selected files intact. |
| Unsaved edit | Mark unsaved state; warn before navigation that would discard it. Preserve draft text during recoverable errors. |
| Stale proposal | Show what changed, block application, and link to reconfirmation/regeneration. The saved plan remains visible. |
| Save conflict/session expiry | Retain local draft fields, require refresh/sign-in, and prevent silent overwriting of a newer version. |

Use the Blooket-inspired visual system in [document 10](10-visual-design.md): a saturated violet sidebar, prominent raised aqua upload action, rounded heavy headings, colorful classroom cards and substantial controls. Use original ClassCompass branding, graphics and implementation. Keep white evidence/editor surfaces, readable 16px body text and clear semantic status badges so the source work and teacher decisions stay prominent. This replaces the earlier muted neutral/teal styling; behavior and approval boundaries stay as specified here.

All controls need visible focus, keyboard access, explicit labels, and adequate touch targets. Status requires text/icon meaning in addition to color. Announce asynchronous completion and validation errors; do not unexpectedly move keyboard focus. Evidence images need meaningful descriptions and adjacent accessible transcriptions; fraction displays include readable text equivalents.

On smaller screens, collapse navigation into a labeled menu and stack evidence above interpretation. Keep a sticky Evidence / Finding / Lesson switcher for the current item rather than shrinking panes. Replace wide comparison tables with paired Before and After cards, and show calendar events as a date-ordered list. At desktop size, essential approval controls must remain reachable without horizontal scrolling.

The implementation is complete only when the same fictional baseline and follow-up can traverse this experience in both configured analysis modes, with clearly distinguishable provenance and all approval boundaries intact. Live-model quality remains a measured acceptance gate, not an assumption of this specification.
