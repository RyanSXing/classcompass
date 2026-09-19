# ClassCompass — agreed prototype brief

Confirmed with the project owner on September 19, 2026. This document records the agreed product scope; implementation has not started in this workspace.

**Historical summary:** the complete, implementation-ready specification now starts at [README.md](README.md). The [decision register](docs/00-decisions-and-scope.md) and numbered documents include the later stack decisions and resolved implementation details; use them for the build.

## Purpose

A teacher-controlled lesson planner that connects student work to the next instructional decision. The central screen places original student evidence beside a proposed lesson change, so the teacher can inspect, correct, and decide.

The prototype demonstrates one complete Grade 5 fraction-addition unit and previews its effect on the wider calendar. The core loop is:

**Upload work → Review findings → Adjust instruction → Teach → Check progress.**

## Agreed classroom and inputs

- Grade 5 math: adding fractions with different denominators, excluding mixed numbers for this demo.
- An uploaded, prepared 45-minute lesson applying fraction addition to word problems.
- A known worksheet template with four questions, clear handwritten calculations, and eight fictional student submissions.
- Each response connects to its question, activity, learning objective, assessment criteria, and original scan.
- Record the task date, difficulty, and help provided. Do not infer that a student worked independently merely because an answer is correct.

The fictional submissions are designed to show these cases. They are a test scenario, not hardcoded analysis results:

| Submissions | Intended evidence case |
| --- | --- |
| 3 | Recurring error involving addition of denominators |
| 2 | Correct answers supported by sound reasoning |
| 1 | Handwriting requiring teacher review |
| 1 | Correct work completed with support |
| 1 | Too little submitted work to support a conclusion |

## Evidence review and teacher control

Support both review modes using the same underlying findings:

1. Review a shared pattern, inspect the contributing answers, and confirm the finding for selected students together.
2. Open an individual answer to inspect its scan, correct its transcription or interpretation, and record support information.

Keep mathematical correctness, interpretation of the difficulty, and independence of performance distinguishable. Missing work or unrecorded support must remain explicit uncertainty.

Both correction types belong in the demonstration:

- **Transcription correction:** The teacher corrects an extracted answer. Recompute the affected mathematical finding and proposed activity or group; retain the source scan.
- **Classroom-context correction:** The teacher records help provided. Correct work remains mathematically correct, while the next recommendation reflects the need to check independent performance.

Use different students for these scenes. Do not fabricate a live recognition failure: use an actual error found during testing, or clearly identify a prepared correction example.

## Lesson proposal and approval

Teacher-confirmed findings inform a proposal to replace the existing 12-minute general practice block within the 45-minute lesson with concurrent differentiated activities:

- Teacher-led fraction-model practice for the targeted group.
- Independent application for students ready to continue.
- An extension task for students with secure evidence.

These activities share the 12-minute block; they are not three consecutive blocks. The remaining lesson time stays accounted for.

For each proposed change, show the original and revised content, rationale, supporting student answers, affected students, and time allocation. The teacher can accept individual changes, edit them, or keep the original.

**Approval boundary:** Confirming evidence does not save a changed lesson. A separate **Apply selected changes** action updates the saved plan. Subsequent corrections or uploads create a revised proposal and never silently overwrite an accepted plan. Unresolved evidence stays available for review rather than becoming a confirmed misconception.

## Materials, calendar, and progress

- Produce a printable targeted activity, an extension task, and two fresh follow-up questions that match the accepted instructional response.
- Preview the targeted support and follow-up dates within the unit and wider calendar. Preserve teacher-set objectives, assessment dates, available teaching days, and fixed deadlines.
- Students receiving targeted support do not automatically delay the rest of the class.
- Upload the two-question independent follow-up with a mixed outcome: some students show evidence supporting a return to the planned activity; another still needs targeted support.
- Add dated observations rather than replacing earlier evidence. Retain work, difficulty, support context, and teacher corrections.
- Distinguish demonstrated independently, demonstrated with support, and insufficient evidence. A successful worksheet does not become a permanent mastery label.

## Acceptance criteria

1. The prepared lesson and eight scans upload successfully; every answer has its question, objective, criteria, and source evidence available.
2. Pattern review and individual review both work, with ambiguous handwriting, insufficient work, and unrecorded assistance distinguishable.
3. A transcription edit preserves the original scan and visibly updates the affected finding and instructional proposal.
4. Recording support changes the interpretation of independence without changing mathematical correctness. Findings can be confirmed individually or together.
5. The before-and-after comparison explains evidence and time costs; selected changes can be accepted, edited, or retained. The saved lesson remains 45 minutes, and later evidence cannot silently overwrite it.
6. Printable activities and follow-up questions are available and consistent with the accepted lesson.
7. The calendar shows targeted support and follow-up while preserving the assessment date and the continuing sequence for other students.
8. Mixed follow-up work adds observations and produces different, evidence-linked next recommendations for students with different results.

## Suggested recording sequence

The complete submission video must fit within five minutes. This timing is a production suggestion, not an additional product requirement.

| Time | Scene |
| --- | --- |
| 0:00–0:25 | Introduce the teacher's planning problem and ClassCompass |
| 0:25–0:55 | Show the existing lesson and upload fictional student work |
| 0:55–1:35 | Inspect the recurring difficulty beside original evidence |
| 1:35–2:20 | Demonstrate transcription and classroom-context corrections |
| 2:20–3:10 | Compare the lesson versions and apply selected changes |
| 3:10–3:40 | Show printable materials and calendar effects |
| 3:40–4:25 | Upload follow-up work and inspect changed recommendations |
| 4:25–4:50 | Explain the implementation, teacher value, and wider vision |

Leave ten seconds of headroom. Label the student data as fictional. A Grade 5 teacher may review the samples and proposed instruction before recording and participate in the video; their involvement is not yet confirmed.

## Team and submission context

The team has four people. Codex will implement the application. The subsequently selected stack is Next.js/TypeScript, Tailwind/shadcn, Supabase, and OpenRouter with Gemma extraction and DeepSeek reasoning; see the [architecture](docs/02-architecture-and-operations.md) for the authoritative details. Teacher participation and individual presentation assignments remain optional.

The [SASEhack 2026 hacker guide](https://sase-hack.notion.site/SASEhack-2026-Hacker-Guide-38b9bed74f8e8093aba7fd8132b70a16) was checked on September 19, 2026:

- Submission and code freeze: September 20, 2026, at 11:59 PM Pacific.
- Submit through Devpost with a presentation video of at most five minutes, a public GitHub repository with a README, and a slides link.
- A deployed website is optional.
- Judging covers technical execution, creativity, usability/design, practical impact/viability, and presentation.

Implementation choices should serve the agreed demonstration. The wider-calendar preview does not require a complete year-long scheduling engine, and the known worksheet does not require arbitrary worksheet-format support.
