# ClassCompass demonstration guide

The recording is **4 minutes 50 seconds**, leaving ten seconds under the submission limit. Lead with a concrete teaching decision, show its evidence, ask a follow-up question, and save a lesson change after a teacher correction. Keep **Sample** labels visible; these are fictional worksheets with prepared readings and disclosed sample assistance.

## Prepare

Start the local app, then choose **Assignments → Load sample class**. This loads five assignments and 120 answers for eight students, without approving notes. Repeat loads preserve edits and reviews. Use a dedicated workspace if you need a clean recording; `npm run demo:reset -- --yes` deliberately clears only the configured local fictional workspace.

For a live upload scene, use **Upload work → First check → Load sample worksheets → Analyze this upload** in a clean workspace. The sample-class shortcut is faster for showing analytics across all five dates. Neither option represents live OCR. Ordinary uploads still accept the supplied PNGs, JPEGs and one-page PDFs.

Rehearse with **Independent check** selected. Keep the October 1 lesson open in a second tab. Leave Finley’s historical First check reading available for the correction scene; explain that it is earlier work. Review the latest assignment’s clear teaching notes before recording if needed, leaving at least one for the on-camera decision. Do not describe previously reviewed notes as newly approved. New planning uses the latest reviewed work, so do not try to generate a September 23 lesson after reviewing later assignments.

Prepare a short teaching goal such as “Help students explain why the parts need the same size, while keeping the lesson to 45 minutes.” Use **Sample** in the teaching brief and Assistant unless a separate live-text check has succeeded. The existing sample worksheet readings retain their labels even when live text assistance is selected.

## 4:50 recording

| Time | Screen and action | Point to explain |
| --- | --- | --- |
| 0:00–0:25 | Overview → Independent check → Generate teaching insights in Sample mode | Start with the next teaching decision. Show a specific follow-up and explain that the teacher chooses what changes. |
| 0:25–0:55 | How learning is developing → Show me why | Open Casey’s dated evidence: earlier help and later independent calculation work. The unfinished question remains a separate follow-up, not a permanent label. |
| 0:55–1:20 | Students to check → Explore the evidence | Show the arithmetic and completion checks first. Briefly open the matrix or a question pattern to demonstrate that the underlying results remain accessible. |
| 1:20–1:55 | Assistant → save the teaching goal → ask “How is Casey’s independence changing, and what should I check next?” | Show the dated sources, recorded help and a fresh check. The assistant uses the saved classroom and goals; it cannot approve notes or save a lesson. |
| 1:55–2:40 | Assignments → First check → Finley Q3 → Edit reading; replace `1/5` with visible `1/2`; then return to the latest work and review teaching notes | Correct a disclosed prepared misread against its source. Keep historical evidence separate from the latest teaching decision; approval remains explicit. |
| 2:40–4:15 | October 1 lesson → Suggest lesson changes; inspect evidence, edit an instruction and save selected changes | Show the teacher’s before-and-after choice and the resulting complete 45-minute plan, with worked examples, concurrent groups and a success check. Open the teacher plan or student activities for printing. |
| 4:15–4:40 | Overview → Open saved lesson; refresh the briefing if it needs updating | A saved lesson stays saved. Changed evidence updates the next recommendation while preserving earlier readings, help and lesson versions. |
| 4:40–4:50 | End on the saved lesson or teaching brief | Name the stack briefly and state that these are fictional data; broader curriculum coverage and real handwriting quality still need evaluation. |

Keep transitions and credits inside these 290 seconds. Caption any skipped wait as **“Processing time shortened.”** If a Grade 5 teacher participates, describe their actual feedback; participation is not yet confirmed.

If time is tight, skip the detailed matrix and printable preview; retain the learning insight, its evidence, cited assistant answer, teacher correction and saved lesson change. Gray's help correction below is a useful alternate scene, but is not required in this shorter recording.

## The two corrections, precisely

1. **Finley (`stu-06`), baseline Q3 (`q-03`).** In **First check**, choose Finley’s Q3 cell, then **Edit reading**. The synthetic image actually contains `2/5 = 4/10; 4/10 + 1/10 = 5/10 = 1/2`. The fixture deliberately supplies an uncertain final `1/5`. Enter the visible working, final answer `1/2`, readable **clear**, and the reason “The original final denominator is 2; the prior step is 5/10.” Choose **Save reading**. This is a simulated misread, not an observed live-model error.
2. **Gray (`stu-07`), baseline submission.** Choose **Edit help given**, select **supported**, and record “I prompted Gray to find a common denominator on each question.” The support applies to every answer on that page. Arithmetic remains correct; the next step becomes an independent check. Update teaching notes and explicitly approve the revised findings before requesting a new proposal.

With those reviewed fictional inputs, expected baseline placement is targeted support for Avery/Blake/Casey, extension for Devon/Emery/Finley, and checks for Gray/Harper. After both fresh follow-up responses are reviewed, Casey remains targeted; Avery/Blake/Gray use application; Devon/Emery/Finley continue extension; Harper needs more evidence. These are regression expectations for this authored scenario, never model prompt instructions or fixed student labels. Blake's follow-up `3/6 meter` is numerically equivalent to `1/2 meter` and must receive credit.

## Fixture and live disclosure

Fixture mode recognizes exact prepared scan hashes and recomputes findings/proposals from effective responses, support context and teacher confirmations. Arbitrary uploads cannot borrow prepared answers based on their filenames. Original scans, initial extraction and teacher revisions remain inspectable. Available static sample PDFs are examples; print the **accepted plan's Materials page** when demonstrating the saved lesson.

Teaching briefs and Assistant conversations use the current saved evidence, teacher goals and lesson context. Sample replies are explicitly labeled; they are not represented as live model calls. Live text assistance can be selected independently of prepared worksheet readings. Briefs and conversations persist after reload, and changed evidence or goals mark prior brief context as needing an update. Their citations resolve to saved classroom records; a suggestion does not change a student's approved note or a saved plan.

The complete **Lesson plan** is a teacher copy: authored teaching guidance, exact saved instructions, worked answers and any saved group names. **Print teacher plan** prints that guide. Student activities and their separate answer keys remain on the Materials page. Do not distribute the teacher plan as a student worksheet.

Live mode uses the explicitly configured provider. `AI_PROVIDER=deepseek` with `DEEPSEEK_API_KEY` selects direct DeepSeek calls billed to that account; `DEEPSEEK_VISION_MODEL` and `DEEPSEEK_REASONING_MODEL` both default to `deepseek-flash`. A two-call direct smoke check read all four answers on one fictional worksheet correctly and produced a student analysis that passed domain validation. This limited result does not establish whole-class or general handwriting accuracy.

`AI_PROVIDER=openrouter` with `OPENROUTER_API_KEY` retains the free-only route: `google/gemma-4-26b-a4b-it:free` for image transcription and `deepseek/deepseek-v4-flash-0731:free` for text analysis/planning. Both provider paths send known questions and actual work, without hidden student reference answers or intended groups. There is no implicit fallback between providers, to prepared results, or to a paid model. Direct DeepSeek must be selected explicitly.

The September 19, 2026 **OpenRouter** handwriting/analysis checks confirmed catalog capabilities, but Gemma remained rate-limited. DeepSeek returned structured text; full-class findings failed validation, while one proposal from previously confirmed fictional evidence passed. A low-reasoning analysis timed out at 75 seconds. **Zero of the sixteen scans in that OpenRouter evaluation were evaluated successfully, and no complete live analysis loop passed.** That historical evaluation covered the baseline and follow-up's 48 answers, not the later five-assignment catalog or the separate direct DeepSeek check. Report each evaluation's exact provider, models, timestamp, scope and correction needs.

Report live chat and teaching-brief results separately from OCR: a successful cited text answer over prepared readings does not validate handwriting extraction. See [verification results](verification-results.md) for the current provider checks and their limits.

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
| **2. A clear decision, backed by data** | Generated teaching brief, student matrix and question patterns; the named students, activity, evidence and next check. Separate uncertain reading from wrong answers. |
| **3. The teacher stays in control** | Cited Assistant response using a saved goal; Finley's disclosed correction; before/after of a selected practice change; complete 45-minute teacher plan. |
| **4. Architecture and verification** | Browser → authenticated API → domain/repository; saved goals/chat; bounded model context and known-source citations; deterministic arithmetic/revision checks. Report actual test and live-provider results separately. |
| **5. Progress and next scope** | Fresh work changes the next recommendation while preserving earlier evidence and help. Show printable teaching support and the fixed assessment. Future real-classroom evaluation and wider curriculum planning; no measured time-saving or learning-impact claim. |

Prepare video and slide links after recording. Recheck the [official SASEhack guide](https://sase-hack.notion.site/SASEhack-2026-Hacker-Guide-38b9bed74f8e8093aba7fd8132b70a16) before final submission; this guide does not assert that a video, slide deck, hosted app or submission has been published.
