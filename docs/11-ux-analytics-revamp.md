# ClassCompass UX and analytics revamp

Status: implemented from the September 19 user request. This plan supersedes conflicting screen layout, wording and two-assignment limits in the original specification. Teacher approval, private source work, immutable history and the fixed assessment remain required. See [verification results](verification-results.md) for tested scope and live-model limits.

## What needs fixing

The initial dashboard counts uploads and workflow steps rather than helping a teacher understand results. Its large hero, duplicated cards and slogans displace useful data. Review combines mathematical errors, uncertain readings, supported success and missing work in the same pattern grid. Answers sit below the first screen. Multiple student selectors compete. Student profiles show long observation histories without a clear assignment comparison. Planning pools the evidence for every change and moves evidence below all changes on mobile. Navigation silently switches lessons when another batch arrives.

The underlying model also assumes exactly two assignments and two lessons. It chooses some records by insertion order, can count repeated uploads more than once, and selects the latest finding per student rather than per student and skill. New lesson catalog entries are absent from existing saved classrooms. One mathematics check incorrectly treats an unrelated equivalent fraction as evidence for the question's method.

## Product rules

- Use short, literal headings and actions. Remove slogans, redundant explanations and raw enum labels. Put technical provenance and history in details, while keeping the sample/live label visible.
- Use four navigation items: **Overview**, **Assignments**, **Students**, **Lessons**. Keep one visible **Upload work** action. Calendar and print materials remain available from lessons.
- Every count, insight and chart must lead to its supporting students and answers. Preserve assignment/student/question/filter selection in the URL where practical.
- Show the original work next to an editable reading. Keep numerical results, reading flags, help given and teacher-approved teaching notes distinct.
- A chart does not approve a finding. Only current teacher-confirmed evidence can justify a saved lesson change.
- Preserve original files, corrections, earlier findings and accepted lesson versions. Adding samples or catalog entries must not erase existing work.
- Keep the eight fictional students. Add coherent assignments within the existing fraction unit; do not imply a real classroom study or learning-impact measurement.

## Screens

| Screen | Main content | Main actions |
| --- | --- | --- |
| Overview | Selected assignment results, answer-result trend, question breakdown, short next-action list | Inspect incorrect answers, check flagged work, review a teaching suggestion |
| Assignments | Five dated assignments with submitted/expected students, processing state and separate result counts | Upload work, load sample class, open results |
| Assignment results | Student × question table, result/student filters, question summary, selected source and answer; separate teaching notes | Edit reading, save and move to the next flagged answer, confirm/edit teaching notes |
| Students | Eight students with dated current results, flags and recorded help; name search | Open a student's details |
| Student details | Results across assignments, help given, skill evidence, specific next steps and exact answer links | Filter work, open a source response, inspect prior reviewed versions |
| Lessons | Explicit dated lesson list, saved/draft state, calendar link | Open lesson, import plan |
| Lesson details | Compact change list: change, students, reason and minutes. Selected change shows its own evidence and before/after content | Edit, keep original, save chosen changes, print |

On mobile, use a proper modal navigation drawer with focus handling. Place evidence with its selected answer/change. Avoid large sticky bars that cover content. Expose selected states and status text to keyboard and screen-reader users.

## Answer and analytics semantics

Each expected student/question slot gets exactly one current result. Use these mutually exclusive primary buckets:

1. **Not received**: no worksheet for that student and assignment.
2. **Not analyzed**: a worksheet exists but the response is not processed.
3. **No answer**: no final answer; distinguish blank from partial working in the detail.
4. **Flagged**: unclear reading, conflicting transcription/working, an unsupported answer format, or inconsistent blank/content metadata prevents a dependable result.
5. **Correct**: a usable numerical answer matches the expected value.
6. **Incorrect**: a usable numerical answer does not match the expected value.

An unresolved flag is not an incorrect answer. A teacher's verified reading can resolve transcription uncertainty; genuinely contradictory reasoning still remains visible as a separate issue. Missing units, explanation quality and recorded help are independent facets, not numerical error counts. Correct supported work stays correct and is never presented as independent success. Do not infer help from an image.

Show counts and denominators. If a percentage is used, its denominator is usable answers (correct + incorrect), and flags/no answers are shown alongside it. Never show a success percentage for an empty denominator. Prefer readable counts in the main UI. Do not call an answer score “mastery,” rank students, or claim that easier tasks or added help prove improvement.

Assignment trends show dated result distributions and disclose that tasks and help may differ. Filter by student, assignment, result and recorded help; provide objective/difficulty context in drilldowns. Comparisons intended to imply progress must use comparable task families, difficulty and assistance. Teaching actions use fresh confirmed findings; raw numerical patterns are phrased as questions/results requiring review.

Use the latest effective upload for each assignment/student, keeping prior attempts accessible and disclosed. Corrections count once. Select current findings by assignment/student/objective and current revisions; exclude rejected/replaced records from current metrics. A newer unreviewed response must not make an old recommendation appear current. Historical evidence opens its recorded response revision and support snapshot.

## Expanded sample class

All assignments use known templates, at most four questions, positive proper fractions and sums no greater than one. Source work is synthetic and visibly labeled. The sequence contains **five assignments, 40 worksheets and 120 responses**.

| Date | Assignment | Questions | Next lesson |
| --- | --- | --- | --- |
| Sep 22 | First check (existing baseline) | 4 | Sep 23 |
| Sep 24 | Quick check (existing follow-up) | 2 | Sep 25 |
| Sep 25 | Fraction practice | 3 | Sep 28 |
| Sep 28 | Word problems | 3 | Sep 29 |
| Sep 30 | Independent check | 3 | Oct 1 |

Keep the original Finley reading correction and Gray help correction. New work must show mixed, plausible evidence: some errors resolving, an occasional later slip, supported success followed by an independent check, incomplete work and at least one reading flag. No student's outcome is permanently fixed by the first worksheet. Every new answer has inspectable working and a validated rational answer key.

New assignments use explicit catalog metadata: template identity, sequence/date, display title, purpose, target lesson and evidence thresholds. Preserve existing template IDs and their meaning. Later independent work can newly support extension when its own evidence meets the threshold; it need not inherit an earlier extension label. The October 2 assessment and later unit dates stay fixed.

Loading the sample class uses real source assets and the same saved evidence structures, with prepared extraction provenance. It is idempotent, preserves existing edits/confirmations, and displays progress. It does not silently confirm teaching findings or use live model calls. Individual assignment uploads and the original step-by-step demo remain usable.

## Implementation sequence

1. **Record this audit and plan.** Establish ownership and shared catalog/analytics contracts before parallel edits.
2. **Data and calculation layer.** Add authored assignment metadata, later lesson snapshots, an idempotent saved-classroom catalog upgrade, pure analytics selectors and dated planning rules. Fix relevant-mathematics validation without silently rewriting historical observations.
3. **Sample assignments.** Author new questions/student work/help conditions, generate source images/PDFs, register exact prepared extractions and update loaders/asset checks.
4. **Teacher interface.** Replace the dashboard, add assignment/student/lesson indexes, rebuild result review around an answer table, simplify individual analysis and connect each lesson change to its own evidence. Sweep all visible copy.
5. **Verification and documentation.** Test semantic counts, correction effects, duplicate attempts, history, plan eligibility, migration, uploads and the complete expanded flow. Inspect desktop/mobile/keyboard/print output. Push verified checkpoints and check GitHub CI.

The existing Next.js/Supabase/OpenRouter stack remains. No new charting dependency or database top-level entity is necessary: the authored assignment catalog maps existing template IDs. Local and Supabase repositories must both preserve saved state. Do not change paid-provider policy or disguise prepared outputs as live AI. Previously measured live-provider limitations remain explicitly documented unless separately reverified.

## Acceptance checks

- A teacher can reach a class result, an individual answer and a lesson action through clearly labeled links without interpreting internal terminology.
- Correct, incorrect, flagged, unanswered and unprocessed totals are disjoint and reconcile with the selected expected population. Supported correctness stays separate from independent evidence.
- Correcting a flagged reading updates its result and totals once, retains the source/history, and invalidates dependent recommendations appropriately.
- Duplicate uploads do not inflate current results. Missing students/questions remain visible. Empty and partially processed data do not fabricate trends.
- Every chart/insight drilldown matches its count, selected assignment/student and current or explicitly historical revision.
- All five assignments and 120 sample responses can be loaded, inspected and filtered; each new lesson target is after its source evidence. Accepted earlier plans and the fixed assessment survive.
- Newly qualifying students can receive extension recommendations from later reviewed independent work. Missing/unclear work cannot generate a misconception or achievement claim.
- Existing saved local and Supabase classrooms gain missing catalog lessons without loss of edits, confirmations, accepted plans or immutable history.
- Desktop and 390px mobile flows, keyboard navigation, uploads, processing resume, selected application and printing pass. No new browser errors or horizontal overflow.
- Local checks and final GitHub CI pass. Reports distinguish deterministic/prepared behavior from live-provider quality; no claim of flawless behavior beyond actual verification.
