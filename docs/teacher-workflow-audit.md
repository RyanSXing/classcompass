# Teacher workflow audit

September 19, 2026. The audit follows a teacher from uploading work through reviewing evidence, planning, printing and checking later work. Tests use fictional students and isolated test data. The original purple/aqua design is retained.

## Failures found and fixed

| Teacher action | Failure found | Change |
| --- | --- | --- |
| Ask who is in the class | Sample chat returned unrelated teaching advice. Live chat required achievement evidence just to list names. | Roster questions use the actual roster and its citations. Unsupported sample questions explain the limitation. |
| Choose live assistance | An already-open assistant could keep the old default after server settings changed. | The untouched choice follows current configuration; sending and retrying explicitly name the mode. |
| Ask a classroom question | A recoverable missing citation ended in an error. | One targeted correction uses validation feedback and is checked again. Invalid replies never silently become sample replies. |
| Generate findings or a lesson | Repeated job attempts sent the same invalid output request without corrective feedback. | One correction pass supplies the rejected rule and allowed evidence/group placements. Repeated invalid drafts pause for teacher retry. |
| Open a cited answer | Every exact revision link looked historical, even for the current answer, hiding editing and current help. | Only older revisions, superseded uploads or older help snapshots are read-only. Current citations remain editable. |
| Inspect another question | Evidence links retained the previous question and result filters. | Links select the cited student and question and clear conflicting filters. |
| Upload an unnamed scan | The app silently selected a student by roster order. | Unrecognized filenames require a student choice. Choices freeze while uploading and remain available after an error. |
| Replace a lesson import | A failed replacement left the previous import draft available to confirm. | A replacement clears the old draft immediately; failed parsing cannot confirm it. |
| Continue with missing work | An empty result had no nearby upload path. | Review has assignment-specific upload links and clear empty-filter recovery. |
| Correct help given | Save errors could leave the dialog without a useful explanation. | The dialog preserves the draft and displays the error. |
| Read class and student results | Two correct answers plus a blank looked like 2/2. | Main totals and the student matrix include every question; wrong, flagged and missing answers remain separate. |
| Compare assignments | The default could choose an assignment with no calculation questions, producing an empty comparison. | Where possible, the default chooses the nearest earlier assignment containing calculations. The teacher can still select another assignment. |
| Move from evidence to a lesson | Planning controls were below a long document; older reviewed work could send the teacher to a blocked lesson. | Overview shows one next step. Lesson controls come before the full teacher plan, with direct links to needed reviews. Handoffs select the lesson after the latest reviewed work. |
| Recover from processing failure | Paused, cancelled and failed work all said the analysis was saved. | Status copy distinguishes each case and explains the available recovery action. |

## Verification

Final checks passed: 181 domain/service tests across 21 files, all 16 Chromium workflow scenarios without retries, 665 authored-specification assertions and 84 local document links, ESLint, TypeScript, and the production build. The build guard checked 33 browser assets and 16 server traces for private-data exclusion.

The browser suite covers real PNG upload, PDF lesson import, correction of readings and help, individual and bulk finding approval, selective lesson changes, history, printing, calendar constraints, follow-up work, analytics links, saved goals and chat, stale/concurrent edits, partial uploads, error recovery, and 390px/keyboard use. Failure-injection tests intercept only the request being tested; normal workflow requests use the actual app API and isolated repository.

A fresh direct DeepSeek run used all eight baseline PNGs, including their actual image bytes, without supplying reference transcripts to the model. It completed in 31.6 seconds using ten calls: eight vision calls, one analysis and one proposal. All 32 final-answer readings and parser classifications matched the authored visible work in this run. Eight findings passed review validation; the three proposed changes preserved the 45-minute lesson, concurrent groups, recorded help and fixed dates. Teacher review was simulated in an isolated copy. This is a bounded synthetic-data check, not real-classroom accuracy validation.

The follow-up analysis and proposal also passed a two-call check using previously captured fictional readings. A separate fresh-fixture assistant check answered a roster question and a practical teaching question in 1.7 and 5.5 seconds. Earlier rejected outputs remain recorded rather than being relabeled as passes. The saved classroom's live briefing was refreshed through the actual interface, and its citation opened the current answer with editing controls available.

Private diagnostic files stay under `.local/`: `fresh-live-teacher-workflow.json`, `live-workflow-repair-verification.json`, `assistant-workflow-fictional-v3.json` and the browser-run log. No credentials or private runtime data are included in Git.

## Scope

This audit covers the registered five-assignment Grade 5 fraction unit and eight fictional students. It does not establish support for arbitrary curricula or real handwriting. Teachers still inspect sources and approve instructional decisions. Provider outages and unseen model mistakes remain possible; errors retain saved work and provide a retry path.
