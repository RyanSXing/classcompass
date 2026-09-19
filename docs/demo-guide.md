# ClassCompass demonstration guide

Show a teacher making a decision from evidence, correcting that evidence, and accepting a concrete change to the next lesson. The recording below runs **4 minutes 50 seconds**, leaving ten seconds under the five-minute submission limit. It implements the storyboard in [the curriculum specification](04-demo-and-curriculum.md#five-minute-submission-450-script) and the delivery outline in [document 06](06-validation-and-delivery.md).

## Prepare the recording

Use a dedicated local fictional workspace with `DATA_BACKEND=local` and `AI_MODE=fixture`. Follow the root README setup, start `npm run dev`, and open `http://127.0.0.1:3000/classroom`. Keep the **Fictional student data** and **Fixture analysis** labels visible. This guide is a rehearsal procedure, not a claim that final browser, production or connected verification has passed.

The classroom begins with authored lesson plans and eight fictional students; findings and accepted changes are created through the workflow. For a clean recording, use **Reset demo → Reset fictional work** in this dedicated workspace. The command-line equivalent is `npm run demo:reset -- --yes`; it clears the configured local fictional work and generated uploads. `npm run demo:seed` only loads baseline worksheets for review and preserves an existing batch.

Pre-stage the September 23 lesson PDF or runtime JSON and both sets of eight PNGs. Use **Import lesson** to preview and confirm the original five blocks. In **Upload work**, select the baseline assignment, choose the eight baseline PNGs, check each student mapping and record the initial fictional independent conditions. Gray's later support correction is intentional. The **Load fictional baseline work** shortcut loads the same authored scans through storage and creates an unreviewed batch; if using it, narrate it as loading samples. It does not perform a live transcription or confirm a finding.

Routine waiting may be cut with the visible caption **“Processing time shortened.”** Prepared outputs must additionally keep their fixture disclosure. Record short cuts for repetitive mapping/confirmation so the evidence inspection and teacher decisions remain readable. Do not compress a several-minute provider wait into an implied speed claim.

## Exact 4:50 script

| Time | On screen and action | Narration |
| --- | --- | --- |
| **0:00–0:25** | Title and September 23 lesson. Show the data/mode labels. | “Student work tells a teacher what happened. ClassCompass connects that evidence to a specific decision about what to teach next. This demonstration uses fictional worksheets and explicitly labeled prepared analysis.” |
| **0:25–0:55** | Show the original 45-minute plan and known assignment; upload the baseline scans or visibly load the fictional samples. Start analysis. | “This is a fictional Grade 5 class learning fraction addition. Each worksheet stays connected to its questions, learning objectives and assessment criteria. The original lesson remains available while I review the work.” |
| **0:55–1:35** | Open the Avery/Blake/Casey pattern, inspect two different written responses, then confirm the selected findings. | “These written steps repeatedly add the denominators. I can inspect the evidence behind the shared pattern and confirm each student's finding. Missing or uncertain work does not establish the same misconception.” |
| **1:35–2:20** | Correct Finley Q3; then change Gray's recorded help. Refresh findings and confirm the reviewed interpretations. | “This is a prepared correction example. Finley's source says one-half; I correct the transcription and keep its history. Gray's mathematics is correct, but I provided prompts. Recording that support changes the independence claim and the suggested next activity. The lesson has not changed yet.” |
| **2:20–3:10** | Open **Adjust instruction → Suggest lesson changes**. Inspect source evidence beside the comparison. Keep the original exit task; select the concurrent practice replacement and checkpoint, then apply. | “The proposal replaces one 12-minute block with simultaneous activities: targeted support, application with brief checks, and extension. It covers every student while the lesson stays 45 minutes. I can edit a suggestion, keep the original, or accept individual changes. Here I keep the original exit task.” |
| **3:10–3:40** | Open accepted student materials, then the unit calendar. Show September 24's check, October 2 assessment and October 5–9 next unit. | “The printable practices equal-sized parts. It belongs to this saved lesson version. The eight-minute follow-up fits inside the next lesson, leaving 37 minutes for planned teaching. The assessment and next-unit dates stay where I set them.” |
| **3:40–4:25** | Load/upload the fresh follow-up, review findings, and open the September 25 proposal. Show Gray's dated history and Harper's retained completed response. | “New independent work changes what happens next. Avery and Blake return to application; Casey continues targeted support. Gray now has independent evidence as well as earlier supported success. Harper's completed answer counts, while the blank asks for more evidence. This updates September 25, preserving the lesson already taught.” |
| **4:25–4:50** | Brief architecture/team visual, then return to evidence beside the lesson. | “The model reads and proposes, code checks arithmetic, references and timing, and the teacher controls interpretations and saved plans. This working unit demonstrates the decision loop. Wider curriculum adaptation and performance on real classroom handwriting still need evaluation.” |

The eight segments total **290 seconds**. Include credits and transitions inside those segments. A Grade 5 teacher may present the review scenes if available; identify their actual role and feedback accurately. Teacher participation is unconfirmed, and the fictional example is not evidence of classroom impact.

## The two corrections, precisely

1. **Finley (`stu-06`), baseline Q3 (`q-03`).** In **Individual work**, choose Finley, then **Show question 3 → Edit / verify reading**. The synthetic image actually contains `2/5 = 4/10; 4/10 + 1/10 = 5/10 = 1/2`. The fixture deliberately supplies an uncertain final `1/5`. Enter the visible working, final answer `1/2`, readable **clear**, and the reason “The original final denominator is 2; the prior step is 5/10.” Save the reviewed reading. This is a simulated misread, not an observed live-model error.
2. **Gray (`stu-07`), baseline submission.** Choose **Edit recorded help**, select **supported**, and record “I prompted Gray to find a common denominator on each question.” The support applies to every answer on that page. Arithmetic remains correct; the next step becomes an independent check. Refresh and explicitly confirm the revised findings before requesting a new proposal.

With those reviewed fictional inputs, expected baseline placement is targeted support for Avery/Blake/Casey, extension for Devon/Emery/Finley, and checks for Gray/Harper. After both fresh follow-up responses are reviewed, Casey remains targeted; Avery/Blake/Gray use application; Devon/Emery/Finley continue extension; Harper needs more evidence. These are regression expectations for this authored scenario, never model prompt instructions or fixed student labels. Blake's follow-up `3/6 meter` is numerically equivalent to `1/2 meter` and must receive credit.

## Fixture and live disclosure

Fixture mode recognizes exact prepared scan hashes and recomputes findings/proposals from effective responses, support context and teacher confirmations. Arbitrary uploads cannot borrow prepared answers based on their filenames. Original scans, initial extraction and teacher revisions remain inspectable. Available static sample PDFs are examples; print the **accepted plan's Materials page** when demonstrating the saved lesson.

Live mode uses OpenRouter with `google/gemma-4-26b-a4b-it:free` for image transcription and `deepseek/deepseek-v4-flash-0731:free` for text analysis/planning. It sends known questions and actual work, without hidden student reference answers or intended groups. It never silently substitutes fixture results or a paid model.

The September 19, 2026 availability checks confirmed catalog capabilities but three Gemma attempts returned rate limits and one DeepSeek structured-output call reached its 75-second timeout. **Zero of the sixteen scans were evaluated successfully; transcription quality and model recommendation quality remain unmeasured.** Do not present this recording as a successful live-model benchmark. A later successful evaluation should report its exact models, timestamp, 48-response comparison and correction needs separately.

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
