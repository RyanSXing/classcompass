# ClassCompass demonstration guide

The recording is **4 minutes 50 seconds**, leaving ten seconds under the submission limit. Show the answer data, a teacher correction and the resulting lesson decision. Keep the **Sample mode** label visible; these are fictional worksheets with prepared results.

## Prepare

Start the local app, then choose **Assignments → Load sample class**. This loads five assignments and 120 answers for eight students, without approving notes. Repeat loads preserve edits and reviews. Use a dedicated workspace if you need a clean recording; `npm run demo:reset -- --yes` deliberately clears only the configured local fictional workspace.

For a live upload scene, use **Upload work → First check → Load sample worksheets → Analyze this upload** in a clean workspace. The sample-class shortcut is faster for showing analytics across all five dates. Neither option represents live OCR. Ordinary uploads still accept the supplied PNGs, JPEGs and one-page PDFs.

## 4:50 recording

| Time | Screen and action | Point to explain |
| --- | --- | --- |
| 0:00–0:25 | Overview with all five assignment bars | One class, five assignments. Every count opens its answers. Tasks and help may differ; this is fictional evidence, not a measured impact study. |
| 0:25–1:00 | Select First check, open Incorrect, choose Avery Q1 and Q2 | Inspect repeated denominator addition in the written steps. Incorrect answers and unclear readings are separate. |
| 1:00–1:40 | Open First check’s flagged Finley Q3, edit `1/5` to the visible `1/2` | Correct the prepared misread. Show the original work and retained reading history. |
| 1:40–2:15 | Edit Gray’s help to supported, update notes and approve reviewed notes | The answer stays correct. Help changes the next teaching step. Approval is separate from reading correction. |
| 2:15–3:05 | Plan the next lesson; suggest changes; select practice; inspect its source evidence; keep the original exit task; save selected changes | Each change names students, reason and minutes. The teacher edits and chooses. The lesson remains 45 minutes. |
| 3:05–3:35 | Open materials and calendar | Show the printable task, fixed October 2 assessment and the wider calendar. |
| 3:35–4:25 | Casey’s student page: compare supported Fraction practice with later independent work; open Independent check, approve notes and preview October 1 | Follow the same students over time. Later independent evidence can support a new next step, while earlier help and missing work remain visible. |
| 4:25–4:50 | Return to overview or the selected lesson change | Briefly name the stack and team roles. State that wider curriculum support and real handwriting quality still need evaluation. |

Keep transitions and credits inside these 290 seconds. Caption any skipped wait as **“Processing time shortened.”** If a Grade 5 teacher participates, describe their actual feedback; participation is not yet confirmed.

## The two corrections, precisely

1. **Finley (`stu-06`), baseline Q3 (`q-03`).** In **First check**, choose Finley’s Q3 cell, then **Edit reading**. The synthetic image actually contains `2/5 = 4/10; 4/10 + 1/10 = 5/10 = 1/2`. The fixture deliberately supplies an uncertain final `1/5`. Enter the visible working, final answer `1/2`, readable **clear**, and the reason “The original final denominator is 2; the prior step is 5/10.” Choose **Save reading**. This is a simulated misread, not an observed live-model error.
2. **Gray (`stu-07`), baseline submission.** Choose **Edit help given**, select **supported**, and record “I prompted Gray to find a common denominator on each question.” The support applies to every answer on that page. Arithmetic remains correct; the next step becomes an independent check. Update teaching notes and explicitly approve the revised findings before requesting a new proposal.

With those reviewed fictional inputs, expected baseline placement is targeted support for Avery/Blake/Casey, extension for Devon/Emery/Finley, and checks for Gray/Harper. After both fresh follow-up responses are reviewed, Casey remains targeted; Avery/Blake/Gray use application; Devon/Emery/Finley continue extension; Harper needs more evidence. These are regression expectations for this authored scenario, never model prompt instructions or fixed student labels. Blake's follow-up `3/6 meter` is numerically equivalent to `1/2 meter` and must receive credit.

## Fixture and live disclosure

Fixture mode recognizes exact prepared scan hashes and recomputes findings/proposals from effective responses, support context and teacher confirmations. Arbitrary uploads cannot borrow prepared answers based on their filenames. Original scans, initial extraction and teacher revisions remain inspectable. Available static sample PDFs are examples; print the **accepted plan's Materials page** when demonstrating the saved lesson.

Live mode uses OpenRouter with `google/gemma-4-26b-a4b-it:free` for image transcription and `deepseek/deepseek-v4-flash-0731:free` for text analysis/planning. It sends known questions and actual work, without hidden student reference answers or intended groups. It never silently substitutes fixture results or a paid model.

The September 19, 2026 checks confirmed catalog capabilities, but Gemma remained rate-limited. DeepSeek returned structured text; full-class findings failed validation, while one proposal from previously confirmed fictional evidence passed. A low-reasoning analysis timed out at 75 seconds. **Zero of the sixteen scans were evaluated successfully, and no complete live analysis loop passed.** Do not present this recording as a successful live-model benchmark. A later successful evaluation should report its exact models, timestamp, 48-response comparison and correction needs separately.

## Source files and downloads

All files below are also served under `/demo/` while the app runs. The [manifest](../public/demo/manifest.json) records identities and SHA-256 hashes without student ground-truth answers. See [asset generation](asset-generation.md) for regeneration, source font licenses and visual inspection notes.

| Use | Files |
| --- | --- |
| Lesson import | [September 23 PDF](../public/demo/lesson-2026-09-23-original.pdf), [September 23 JSON](../public/demo/lesson-2026-09-23-original.json), [September 25 JSON](../public/demo/lesson-2026-09-25-original.json) |
| Blank worksheets | [Four-question baseline](../public/demo/baseline-template-v1.pdf), [two-question fresh follow-up](../public/demo/followup-template-v1.pdf) |
| Example student activities | [Targeted equal-parts practice](../public/demo/targeted-equal-parts-v1.pdf), [extension](../public/demo/extension-explain-v1.pdf), [exit question](../public/demo/exit-equal-units-v1.pdf) |
| Separate teacher key | [Answer keys](../public/demo/classcompass-teacher-answer-keys.pdf) — keep separate from student printouts |

| Fictional student | Baseline scan | Follow-up scan |
| --- | --- | --- |
| Avery | [PNG](../public/demo/baseline-stu-01.png) | [PNG](../public/demo/followup-stu-01.png) |
| Blake | [PNG](../public/demo/baseline-stu-02.png) | [PNG](../public/demo/followup-stu-02.png) |
| Casey | [PNG](../public/demo/baseline-stu-03.png) | [PNG](../public/demo/followup-stu-03.png) |
| Devon | [PNG](../public/demo/baseline-stu-04.png) | [PNG](../public/demo/followup-stu-04.png) |
| Emery | [PNG](../public/demo/baseline-stu-05.png) | [PNG](../public/demo/followup-stu-05.png) |
| Finley | [PNG](../public/demo/baseline-stu-06.png) | [PNG](../public/demo/followup-stu-06.png) |
| Gray | [PNG](../public/demo/baseline-stu-07.png) | [PNG](../public/demo/followup-stu-07.png) |
| Harper | [PNG](../public/demo/baseline-stu-08.png) | [PNG](../public/demo/followup-stu-08.png) |

## Five-slide outline

| Slide | Message and visual |
| --- | --- |
| **1. What should I teach next?** | Teacher problem; the loop **Upload → Review → Adjust → Teach → Check**; one Grade 5 unit and explicit fictional-data label. |
| **2. Evidence that a teacher can correct** | Original question beside the finding; Finley's disclosed simulated misread; Gray's support correction; no permanent student labels. |
| **3. An accepted instructional change** | Before/after of the 12-minute practice block; targeted/application/extension activities; accepted printable; unchanged 45-minute total and fixed assessment. |
| **4. Architecture and verification** | Browser → authenticated API → domain/repository; image and text model boundaries; deterministic arithmetic/revision checks. Show actual test results only after they are recorded; disclose the blocked live evaluation. |
| **5. Progress and next scope** | Fresh follow-up changes September 25 while preserving earlier evidence; intended teacher value; future real-classroom evaluation and wider curriculum planning. No measured time-saving or learning-impact claim. |

Prepare video and slide links after recording. Recheck the [official SASEhack guide](https://sase-hack.notion.site/SASEhack-2026-Hacker-Guide-38b9bed74f8e8093aba7fd8132b70a16) before final submission; this guide does not assert that a video, slide deck, hosted app or submission has been published.
