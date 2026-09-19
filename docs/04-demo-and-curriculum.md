# Demo, curriculum, and fictional classroom

This document is the content specification for the complete Grade 5 fraction-addition demonstration. The machine-readable source of question IDs, reference transcripts, lesson blocks, materials, and dates is [fixtures/classroom.json](fixtures/classroom.json). These fictional examples are designed to make the product's behavior inspectable. They are not evidence that a particular model can already read the handwriting or make useful recommendations.

No worksheet PDFs, handwriting scans, or printable files have been produced by this documentation task. The asset manifest below specifies what the implementation must create and verify.

## Teaching scope and assessment rules

- **Unit:** `unit-fractions-v1`, September 21–October 2, 2026.
- **Topic:** Grade 5 addition of positive proper fractions with unlike denominators. All prescribed sums are at most one; exclude mixed numbers.
- **Learning objectives:** represent equivalent fractions using equal-sized wholes; add fractions by expressing them in a common fractional unit; explain a word-problem total with working and units.
- **Task difficulty:** baseline calculation items are core; word problems require core transfer. Extension adds explanation and comparison of methods without introducing an unannounced prerequisite.
- **Assessment criteria:** preserve fraction values when renaming; use a common unit; add numerators while retaining that unit; show an inspectable method; state the word-problem unit.
- **Equivalence:** `5/10` and `1/2` are both mathematically correct. A nonleast common denominator is valid. Simplification is optional unless a future question explicitly requests it.
- **Separate observations:** numerical correctness, evidence of method, interpretation of a pattern, and assistance are distinct fields. A missing unit can prompt a communication observation without changing a correct fraction into an arithmetic error.
- **Evidence language:** use “demonstrated independently in this task,” “demonstrated with support,” or “not enough evidence yet.” Do not show permanent mastery, ability rankings, or a diagnostic label.

The teacher may confirm a specific repeated error after inspecting several answers. A correct answer without working is evidence of that answer's correctness, not proof of the reasoning used. Assistance must be teacher-recorded, including unknown assistance when it has not been established.

## Baseline worksheet: `baseline-template-v1`

Administer on **September 22, 2026**. Student directions: “Show calculation steps or a labeled model. Use the same-sized whole in every model. You may leave a correct answer unreduced. If you are unsure, show what you can do.” The teacher records assistance separately.

| ID | Full question | Teacher answer and expected working |
| --- | --- | --- |
| `q-01` | Calculate **1/2 + 1/3**. Show how you make equal-sized parts before adding. | `1/2 = 3/6`; `1/3 = 2/6`; `3/6 + 2/6 = 5/6`. |
| `q-02` | Calculate **1/4 + 2/3**. Show your equivalent fractions and the sum. | `1/4 = 3/12`; `2/3 = 8/12`; `3/12 + 8/12 = 11/12`. |
| `q-03` | Calculate **2/5 + 1/10**. Show your steps. You may simplify your answer. | `2/5 = 4/10`; `4/10 + 1/10 = 5/10 = 1/2`. |
| `q-04` | A class uses **3/8 meter** of ribbon for one display and **1/4 meter** for another. How many meters of ribbon does it use altogether? Show your working and include the unit. | `1/4 = 2/8`; `3/8 + 2/8 = 5/8 meter`. |

Use positive quantities and equal wholes in every model. Do not replace this worksheet with arbitrary question generation during the core demo: the stable template makes source evidence and arithmetic verifiable.

## Eight fictional submissions

The names are invented first names for demonstration. Their stable IDs, not handwritten name recognition, determine file ownership. The JSON contains all **32 full written responses**; the table summarizes the intended coverage.

| Student | Baseline answers, q-01 through q-04 | What a teacher can inspect | Intended response after review |
| --- | --- | --- | --- |
| `stu-01` Avery | `2/5`; `3/7`; `3/15 = 1/5`; `4/12 = 1/3 meter` | Adds numerators and denominators repeatedly, with an explicit component-wise addition step on q-01. | Targeted equal-parts practice. |
| `stu-02` Blake | `2/5`; `3/7`; `3/15`; `4/12 meter` | Writes the numerator and denominator additions separately on every item. | Targeted equal-parts practice. |
| `stu-03` Casey | `2/5`; `3/7`; `3/15`; `4/12 meter` | Says “I added the tops and the bottoms,” supported by written steps. | Targeted equal-parts practice. |
| `stu-04` Devon | `5/6`; `11/12`; `1/2`; `5/8 meter` | Valid equivalent fractions and working across all four items; task recorded as independent. | Extension with justification. |
| `stu-05` Emery | `10/12 = 5/6`; `11/12`; `10/20 = 1/2`; `5/8 meter` | Correct nonleast common denominators on q-01 and q-03. The checker must accept these. | Extension with comparison of methods. |
| `stu-06` Finley | `5/6`; `11/12`; **actual handwritten `1/2`**; `5/8 meter` | On q-03, a final denominator could be read as `5`; the earlier `5/10` step supports review of an inconsistency. | Keep q-03 unresolved until inspected; extension may be proposed after correction and confirmation. |
| `stu-07` Gray | `5/6`; `11/12`; `1/2`; `5/8 meter` | Arithmetic is correct. A teacher prompt to find a common denominator was provided on each question. | Brief independent check before ordinary application. |
| `stu-08` Harper | Only `1/2 = 3/6` on q-01; three blanks | The one equivalence is valid, but there is no completed addition response. | Gather a completed response; do not infer a misconception. |

All initial task entries in this fictional fixture are teacher-recorded as independent. Gray's entry is deliberately a **teacher metadata error** that the demo corrects. The model must never invent independence from correct answers. The truthful baseline observation for Gray after correction is “demonstrated with support.”

The intended categories are **test expectations**, not student labels to send to the model. A live run must derive observations from actual extracted work and teacher review. If a model disagrees, the UI must expose that result and allow correction; it must not silently replace it with the fixture expectation.

## Two correction scenes

### 1. Finley: correct the transcription

The human-authored q-03 response is:

> 2/5 = 4/10; 4/10 + 1/10 = 5/10 = 1/2

The prepared misread, if needed for a reproducible test, is:

> 2/5 = 4/10; 4/10 + 1/10 = 5/10 = 1/5

Use an actual model recognition error discovered on the final scan if one occurs. If the reader accurately reads all scans, expose the prepared example with the visible label **“Prepared correction example — simulated extraction error.”** Do not claim the model made that error live. An actual scan has not yet been created, so this document does not assert that the glyph will confuse any particular model.

Expected behavior:

1. Select Finley's q-03 from the uncertain-work list and see the original crop and extracted text together.
2. The teacher changes the final `1/5` to `1/2`, supplies the correction reason, and confirms the response.
3. Preserve the source image, initial transcript, correction, author, and time. Recheck the corrected fraction and steps.
4. Resolve the inconsistency and refresh the **draft** recommendation. Before review, Finley may continue independently with an unresolved q-03; after confirmation, the teacher can select extension based on the complete response set.
5. Show the affected evidence and draft lesson change. A saved lesson remains unchanged until the teacher applies the revised selection.

Do not treat a single ambiguous glyph as proof of a denominator misconception. Do not hide valid intermediate working when presenting the final answer.

### 2. Gray: correct the support context

Teacher statement: **“I prompted Gray to find a common denominator on each question.”**

Expected behavior:

1. Open Gray's correct work, with initial task context visibly recorded as independent by the teacher.
2. Change support to `supported`, applying to all four responses, and record the teacher statement.
3. Keep mathematical correctness unchanged. Revise the performance observation from independent to supported.
4. Replace the extension candidate with a proposed short independent check and then application as appropriate. Display why the recommendation changed.
5. Keep the original metadata entry and correction history. Do not automatically move a student in the saved lesson without the teacher's application action.

These scenes use different students so judges can distinguish an extraction correction from a change to the interpretation of correct work.

## Original and revised 45-minute lesson

Lesson ID: `lesson-2026-09-23`. Date: **September 23, 2026**. Title: **Apply fraction addition to word problems**.

| Block ID | Original block | Minutes | Proposed behavior |
| --- | --- | ---: | --- |
| `warmup` | Recall equivalent fractions with equal wholes. | 5 | Keep. |
| `model` | Teacher models a word problem using common fractional units. | 8 | Keep. |
| `practice` | Every pair works on the same two word problems. | 12 | Replace with concurrent targeted practice, independent application, and extension. |
| `application` | Students solve and explain further word problems while the teacher circulates. | 15 | Keep. |
| `exit` | Individual calculation and explanation. | 5 | Keep; supply the exit material below. |
| **Total** | | **45** | **Still 45.** |

The practice block occupies elapsed lesson minutes **13–25**. Its three activities happen at the same time and therefore cost **12 minutes total**, not 36. The teacher-led activity can include a brief glance at completed independent entry checks while the targeted group draws. Avoid scripting the teacher as delivering three simultaneous lessons.

Anticipated teacher-approved grouping after both corrections:

- **Targeted equal-parts practice:** Avery, Blake, Casey. Evidence links include their confirmed component-wise additions.
- **Independent application pathway:** Gray and Harper begin with a three-minute entry check. Gray needs independent evidence after supported work; Harper needs a completed response. These are different reasons, even though they can use the same short check.
- **Extension:** Devon, Emery, Finley after Finley's response is resolved and the teacher approves.

The entry check is a teacher action within the independent pathway, not a fourth ability group. The teacher can edit all suggested membership and activities. No group is named “low,” “high,” “weak,” or “gifted.” Every student must have exactly one activity placement before the block can be applied. An unresolved student receives a neutral independent-application or information-gathering placement with an explicit check-in instruction; uncertainty does not justify a skill claim or removing the student from the roster.

The before-and-after proposal must show original content, replacement content, student IDs, supporting question evidence, rationale, and the unchanged duration. Confirming the evidence and accepting the changed plan are separate actions. After application, a later correction creates a new proposal against the saved lesson version.

## Printable teaching content and teacher keys

Printables must include title, purpose, space for name/date, clear directions, sufficient working space, and no private API or implementation metadata. Student pages exclude answers, scenario labels, and inferred grouping. Teacher keys are separate. Render fractions readably using the app's selected fraction presentation; print must retain them.

### Targeted activity: Equal parts before adding

ID `targeted-equal-parts-v1`; 12 minutes, teacher-led. Provide equal-length blank fraction bars and fourths/tenths strips.

1. **Use two equal-length fraction strips. Shade 1/2 on one and 1/4 on the other. Rename the halves as fourths, then find 1/2 + 1/4.**
   Teacher key: `1/2 = 2/4`; `2/4 + 1/4 = 3/4`. The strips represent the same whole.
2. **Draw or use equal-length strips to solve 1/5 + 1/10. Label the equal-sized parts and write the matching calculation.**
   Teacher key: `1/5 = 2/10`; `2/10 + 1/10 = 3/10`.
3. **A fictional student says 1/2 + 1/4 = 2/6 because they added both tops and bottoms. Explain what needs to change, then write a correct calculation.**
   Teacher key: halves and fourths are different units; use fourths and find `3/4`. Also, `2/6` is smaller than the positive addend `1/2`, so it cannot be the sum.

Teacher prompts: “Are both wholes the same size?”, “What kind of part are we counting?”, and “Can we rename the fractions without changing their values?” Record worked examples and hints as support on this activity. A successful teacher-led response does not become independent evidence.

### Independent entry check and application

Entry-check ID `entry-check-v1`; approximately three minutes. Administer without hints, shared worked examples, or peer assistance and record actual conditions.

1. **Calculate 1/4 + 1/2. Show one equivalent-fraction step.** Key: `1/2 = 2/4`; sum `3/4`.
2. **Calculate 1/6 + 1/2. Show one equivalent-fraction step.** Key: `1/2 = 3/6`; sum `4/6 = 2/3`.

Application ID `application-practice-v1`; approximately nine remaining minutes, or the full 12 minutes if no entry check is needed:

1. **A class uses 1/4 meter of blue ribbon and 1/5 meter of green ribbon. Find the total length. Show working.** Key: `5/20 + 4/20 = 9/20 meter`.
2. **One plant grows 1/5 meter in a month and another 1/2 meter in the same month. How much growth is that altogether? Show working.** Key: `2/10 + 5/10 = 7/10 meter`.

The teacher chooses the response after inspecting the entry check. The hackathon does not require live, automatic mid-lesson reassignment. If assistance becomes necessary, record it instead of preserving an inaccurate independent label. Additional entry-check scan files are optional and are not part of the required 16 scan assets.

### Extension: Two methods, one value

ID `extension-explain-v1`; 12 minutes.

1. **Solve 1/4 + 2/5 using twentieths and again using fortieths. Explain why the answers have the same value.**
   Key: `5/20 + 8/20 = 13/20`; `10/40 + 16/40 = 26/40 = 13/20`.
2. **Write two different pairs of positive fractions with unlike denominators that add to 3/4. Prove each pair works.**
   Example key: `1/2 + 1/4 = 3/4`; `1/3 + 5/12 = 4/12 + 5/12 = 9/12 = 3/4`. Accept other valid pairs.
3. **Explain why adding the denominators does not count equal-sized parts. Use one of your calculations as evidence.**
   Key: denominators name the size of a part; first express both addends in a common unit, then add the counts of those parts.

### Lesson exit ticket

ID `exit-equal-units-v1`; five minutes on September 23. This is separate from the next day's uploaded follow-up worksheet.

1. **Calculate 1/4 + 1/6. Show how you use equal-sized parts.** Key: `3/12 + 2/12 = 5/12`.
2. **Finish: “Before adding, I rewrite the fractions because…”** Key: the fractions need the same-sized parts/common unit before their counts can be added.

An exit observation may be recorded, but the demo does not require a third batch of uploaded scans. Do not substitute these exit prompts for the reserved follow-up questions.

## Independent follow-up: `followup-template-v1`

Administer on **September 24, 2026**, with actual assistance recorded by the teacher. The fixture records independent task conditions for all eight students. Prior instruction on the previous day is not task assistance.

The two question combinations are reserved from all earlier scripted practice, entry checks, and exit material. They are fresh responses to the same skill, not an unfamiliar mathematical prerequisite.

| ID | Full question | Key |
| --- | --- | --- |
| `fq01` | Calculate **1/3 + 1/4**. Show equivalent fractions or an equal-whole model that explains your answer. | `4/12 + 3/12 = 7/12`. |
| `fq02` | Jules uses **1/6 meter** of ribbon for one tag and **1/3 meter** for another. How much ribbon is used altogether? Show your working and include the unit. | `1/6 + 2/6 = 3/6 = 1/2 meter`. |

The JSON specifies all **16 written responses** and the support context. Anticipated teacher-reviewed outcomes:

| Student | fq01 | fq02 | Proposed next step |
| --- | --- | --- | --- |
| Avery | `7/12`, valid working | `1/2 meter`, valid working | Return to planned application; collect another later observation. |
| Blake | `7/12`, valid working | **`3/6 meter`**, valid working | Return to application. Accept the equivalent unreduced answer. |
| Casey | `2/7`, adds denominators | `2/9 meter`, adds denominators | Continue a short equal-parts activity and ask for an individual explanation. |
| Devon | `7/12`, valid working | `1/2 meter`, valid working | Continue extension. |
| Emery | `14/24 = 7/12` | `6/12 = 1/2 meter` | Continue extension; accept nonleast common denominators. |
| Finley | `7/12`, valid working | `1/2 meter`, valid working | Continue extension; retain the prior correction in history. |
| Gray | `7/12`, valid working | `1/2 meter`, valid working | New independent evidence supports ordinary application. Preserve the supported baseline observation. |
| Harper | `7/12`, valid working | Blank | Record fq01's independent demonstration; request a word-problem response. Do not manufacture a misconception from fq02. |

Two successful fresh responses support a new instructional decision. They do not prove long-term retention or permanent mastery. The next recommendation is a teacher-reviewed proposal against **`lesson-2026-09-25`**, and it does not retroactively rewrite the already taught September 23 lesson.

The fixture includes this future lesson as `nextLesson`, titled **Compare strategies and check reasonableness**, in its original form. Its `warmup`, `model`, `practice`, `application`, and `exit` blocks use **5 + 8 + 12 + 15 + 5 = 45 minutes**. Original practice is ordinary paired strategy comparison. Follow-up evidence can support a proposal replacing that 12-minute block with continued targeted support for Casey, a short information-gathering task for Harper, ordinary application for Avery/Blake/Gray, and extension for Devon/Emery/Finley. These are anticipated fixture decisions, not pre-accepted future group assignments.

## Complete unit and wider-calendar preview

Available teaching dates are the ten weekdays below. Every day's planned teaching time is 45 minutes. Both **September 23 and September 25 require full block-level editing** in the prototype: the first responds to the baseline, and the second responds to reviewed follow-up work. The complete unit sequence gives those changes a meaningful calendar context.

| Date | Planned focus | Evidence or adjustment |
| --- | --- | --- |
| Mon Sep 21 | Equivalent fractions with equal wholes | Establish common quantities and representations. |
| Tue Sep 22 | Addition using common fractional units | Collect the four-question baseline independently. |
| Wed Sep 23 | Apply fraction addition to word problems | Teacher-approved replacement of the 12-minute practice block. |
| Thu Sep 24 | Fraction-addition application and explanation | Proposed eight-minute independent follow-up, followed by 37 minutes of planned teaching, only after the checkpoint change is accepted. |
| Fri Sep 25 | Compare strategies and check reasonableness | Propose a brief targeted revisit for Casey and a word-problem check for Harper, within existing teaching time. |
| Mon Sep 28 | Connect models to written methods | Continue the common unit objective with further examples. |
| Tue Sep 29 | Select and justify a common denominator | Compare valid denominators and equivalent sums. |
| Wed Sep 30 | Explain fraction-addition contexts | Further word problems and additional observations where needed. |
| Thu Oct 1 | Review and short conferences | Address unresolved evidence without removing required objectives. |
| **Fri Oct 2** | **Fixed unit assessment** | **Locked date; unchanged by either recommendation.** |

The October 5–9 window represents a **teacher-provided next unit**, with the topic intentionally unspecified. It demonstrates that the current proposal does not move later teaching. Do not imply an entire year of detailed curriculum has been created.

The calendar comparison shows proposed support/revisit entries, unchanged lesson duration, preserved objectives, the locked assessment, and unchanged next-unit dates. September 23, September 24, and September 25 initially contain **planned lessons**; `proposalEventType` describes the expected demo preview rather than an already accepted event. Show targeted entries as pending until the relevant lesson proposal is applied.

September 24 has `checkpointMinutes: 8` as proposed metadata. Its `originalAllocation` is 45 teaching minutes and zero checkpoint minutes. Its `proposedAllocation` is 37 teaching minutes plus an eight-minute checkpoint at offset zero. Only accepting the separate `schedule_checkpoint` change creates that accepted 37+8 snapshot; leaving the change unselected retains the 45-minute original. Availability of the follow-up template or fixture upload is not evidence that the checkpoint was scheduled.

Objective and calendar prerequisite fields describe curriculum exposure and sequencing, not student mastery. Equivalent fractions precede unlike-denominator addition, which precedes explanation in context; `objectiveSequence` permits the teacher to introduce and apply these in order within a lesson. `prerequisiteObjectiveIds` on calendar entries describes prior exposure, and `prerequisiteCalendarEntryIds` identifies dated anchors. The wider preview preserves the next unit after the October 2 assessment via unit/calendar dependencies; its exact topic and skill prerequisites remain unspecified.

A request to move the locked assessment should produce a visible constraint conflict; it must not silently move it. The core scenario requires no classwide delay.

## Asset production manifest

The full list is in `assetManifest.assets` in the JSON, and every entry currently has `status: specified-not-generated`.

| Asset | Required filenames | Specification |
| --- | --- | --- |
| Blank baseline | `baseline-template-v1.pdf` | One US Letter portrait page; four registered question regions. |
| Blank follow-up | `followup-template-v1.pdf` | One US Letter portrait page; two registered question regions. |
| Baseline scans | `baseline-stu-01.png` through `baseline-stu-08.png` | Eight upright handwritten fictional submissions. |
| Follow-up scans | `followup-stu-01.png` through `followup-stu-08.png` | Eight upright handwritten fictional submissions. |
| Original plan | `lesson-2026-09-23-original.pdf` | Prepared one-page teacher plan matching the five blocks above. |
| Student printables | `targeted-equal-parts-v1.pdf`, `extension-explain-v1.pdf`, `exit-equal-units-v1.pdf` | Generate from accepted content; one usable page each where practical. Browser print/save-to-PDF is acceptable. |
| Teacher key | `classcompass-teacher-answer-keys.pdf` | Separate keys for baseline, activities, exit, and follow-up. Paginate as needed. |

Baseline PDF dimensions are **612 × 792 points**; registered scan target is **1700 × 2200 pixels**. Coordinates below use fractions of the page from the top-left. Regions include the prompt and response, so all written working must fit inside its assigned region.

| Template/question | x | y | width | height |
| --- | ---: | ---: | ---: | ---: |
| Baseline `q-01` | 0.06 | 0.14 | 0.88 | 0.19 |
| Baseline `q-02` | 0.06 | 0.35 | 0.88 | 0.19 |
| Baseline `q-03` | 0.06 | 0.56 | 0.88 | 0.19 |
| Baseline `q-04` | 0.06 | 0.77 | 0.88 | 0.19 |
| Follow-up `fq01` | 0.06 | 0.18 | 0.88 | 0.32 |
| Follow-up `fq02` | 0.06 | 0.55 | 0.88 | 0.38 |

These are template regions, not model-generated tight handwriting boxes. The implementation can highlight the registered question region without claiming glyph-level localization. Before analysis, confirm orientation and alignment against the registered template. If a photograph cannot be aligned, flag it or request a clearer page; do not silently crop unrelated work.

Asset preparation sequence:

1. Render and visually inspect both blank templates; verify that printed fractions, prompts, working areas, and region coordinates agree.
2. Create handwritten responses following the JSON reference transcripts. Keep clearly fictional IDs on each page. Finley's q-03 has a human-intended `1/2`; do not alter mathematical ground truth to make a model look wrong.
3. Scan upright, retain page edges, and check every source-to-question mapping. Teacher or teammate checks all 32 baseline and 16 follow-up transcriptions against the original scans.
4. Run the actual extraction pipeline. Record actual recognition outcomes and keep result provenance. Do not tune away an unexpected result by substituting a fixture result without disclosure.
5. Render student materials separately from teacher keys and inspect print output. Include printable independent entry-check/application content in the UI; separate PDF assets for these are optional.
6. Have the potential Grade 5 teacher review the fictional errors, intervention, timing, and follow-up independently. Their participation remains unconfirmed until arranged.

## Model input versus fixture ground truth

The JSON intentionally contains more information than any live model call should receive. Build adapters with explicit field allowlists; never serialize the complete fixture into a prompt.

Typed math fields keep code from guessing operands out of prose. Every baseline/follow-up question and material prompt has a `validationKind`:

- `fraction-addition`: two `operands`, each `{numerator, denominator}`. Question keys retain `expectedAnswer.canonicalFraction` and add `expectedAnswer.rational`; material keys retain `canonicalFraction` and add `expectedRational`. `answerUnit` is separate from numerical equality.
- `construct-addition`: the open extension asks for two valid pairs, so `operands` is empty and `constructionConstraints` defines positivity, unlike denominators, pair count, and a typed target. `examplePairs` is a teacher-key example, not the only accepted answer.
- `explanation`: there is no fixed numerical result; `operands` is empty, `expectedRational` is null, and `requiresTeacherReview` is true. The checker must not invent an arithmetic verdict for prose.

These typed fields are instructor/checker data, never observed student work. Preserve both the displayed transcript and the separate parsed mathematical result.

| Data | Live extraction | Live reasoning | Teacher/test use |
| --- | --- | --- | --- |
| Uploaded scan and registered regions | Yes | Textual source reference only; the selected DeepSeek endpoint is text-only | Yes |
| Known questions, objectives, rubric | Yes | Yes | Yes |
| Fixture `writtenAnswer` reference transcripts | **No** | **No as a substitute for actual extraction** | Comparison and disclosed playback only |
| Actual extracted/corrected transcript | Extraction output | Yes | Yes |
| Teacher-recorded assistance | No; unnecessary for literal transcription | Yes | Yes |
| Answer key and deterministic checks | Not needed to read handwriting | Checker results may be supplied, separated from observed work | Yes |
| Intended scenario, expected group, future follow-up answers | **No** | **No** | Regression assertions and script only |
| Current lesson and fixed-date constraints | No | Yes | Yes |

Initial AI findings may be wrong or uncertain. Store them as suggestions pending review. A replay or fixture mode can be useful when free-provider capacity is unavailable, but the visible mode label and recording narration must accurately describe it.

## Five-minute submission: 4:50 script

Use the following as a production outline, leaving ten seconds of headroom. Pre-stage files and the initial lesson. Routine waiting may be edited out with the visible disclosure **“Processing time shortened.”** A prerecorded or fixture result must instead retain its explicit replay/fixture label; do not present it as a live call. The five-minute video is a presentation limit, not a promise about live model latency. Display “Fictional student data” throughout the demonstration or prominently at entry.

| Time | Screen/action | Suggested narration |
| --- | --- | --- |
| 0:00–0:25 | Teacher's tomorrow lesson and product title | “Student work tells a teacher what happened. ClassCompass connects that evidence to a specific decision about what to teach next.” |
| 0:25–0:55 | Original 45-minute plan; upload known-template scans | “This is a fictional Grade 5 class learning fraction addition. The questions, objectives, and lesson context travel with each worksheet.” |
| 0:55–1:35 | Pattern view with Avery/Blake/Casey evidence | “These answers repeatedly add the denominators. I can inspect the written steps, review the shared pattern, or change an individual finding.” Confirm selected findings. |
| 1:35–2:20 | Finley then Gray corrections | “This transcription needs correction.” If seeded, say “This is a prepared correction example.” Then: “Gray's answers are correct, but I provided prompts. Recording that support changes the proposed next activity.” |
| 2:20–3:10 | Evidence beside before/after lesson; apply selected changes | “The proposal replaces this 12-minute block with simultaneous activities. The full lesson remains 45 minutes, and I choose which changes to apply.” |
| 3:10–3:40 | Student printable preview; unit calendar | “The targeted activity practices equal-sized parts. The support and follow-up fit inside the unit; the assessment and next-unit dates stay where I set them.” |
| 3:40–4:25 | Follow-up upload and dated observations | “Fresh independent work changes the next recommendation. Avery and Blake can return to the planned activity; Casey still needs a focused check. Gray now has independent evidence, while Harper needs another response.” |
| 4:25–4:50 | One architecture visual or brief team explanation; teacher value | “The model reads and proposes, code checks the arithmetic and timing, and the teacher controls the interpretation and saved plan. This working unit shows how that loop could inform a wider calendar.” |

The central story is the teacher's decision, its supporting evidence, and a visible plan change. Avoid spending recording time scrolling through all students or explaining internal schemas. A real teacher can deliver the review scenes if available; otherwise accurately describe the teacher perspective without implying external validation.

## Content acceptance gates

- Every scan has one explicit student/template association and accessible original evidence.
- All four baseline answers and both follow-up answers have known objectives, criteria, difficulty, date, and support context.
- Correct nonleast denominators and unreduced fractions pass mathematical equivalence checks.
- Finley's correction changes the affected response and draft proposal without replacing the original evidence or pretending to be a live failure.
- Gray's support correction leaves arithmetic correct and changes the independence interpretation.
- Harper's missing responses remain missing evidence; the valid follow-up response is retained separately.
- The activity set changes one 12-minute block, with 45 minutes total; the October 2 assessment stays locked.
- Follow-up recommendations are based on new recorded work and do not overwrite earlier observations or the already taught lesson.
- Generated assets match their written specification, are visually checked, and disclose fictional data and any replayed result.
