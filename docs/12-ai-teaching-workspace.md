# AI teaching workspace

This revision follows the teacher-first request after the analytics revamp. The product should answer **what to teach, to whom, why, and how to check it worked** before asking a teacher to explore charts.

## Main decisions

- Lead Overview with a short instructional brief and a few concrete next actions. Each action names students, gives a bounded activity and time, links the supporting work, and says what to check next.
- Keep mathematical errors, reading uncertainty, missing work and recorded assistance separate. Unreviewed patterns are suggestions, never approved findings or permanent student labels.
- Add question-pattern analysis and an eight-student assignment matrix. Show counts, help, and gaps alongside results. Changes across different tasks are observations, not proof of learning gains.
- Make lessons complete teaching documents: objectives, success criteria, materials, preparation, timed instruction, worked examples, discussion questions, practice groups and exit checks. Preserve exact saved instructions and teacher edits. Authored teaching support is distinguished from AI proposals.
- Add a classroom assistant with saved teacher goals and conversation history. It can explain evidence, compare work, suggest activities and discuss plans. It cannot silently approve findings or change a saved lesson.

## One path from evidence to teaching

1. Open Overview and choose the relevant assignment.
2. Read the suggested action and inspect its student answers.
3. Confirm or correct the teaching notes.
4. Open the next lesson, review suggested changes, and save selected changes.
5. Teach from the full lesson plan and collect the next check.

The assistant is available throughout this path. Links carry the selected student, assignment or lesson into its context. It explains what it knows and cites the saved evidence behind its answer.

## Assistant and AI brief

The server assembles context from the authenticated classroom: current effective worksheet responses and math checks, assistance, question criteria, clearly dated reviews, current saved lessons, accepted edits, teaching materials, calendar constraints, saved teacher goals, and bounded conversation history. Original image files remain accessible through citations; secrets, binary files and private reference extraction fixtures are never included in model prompts.

All returned citations resolve to server-known records. A model supplies source IDs, never arbitrary links. Suggestions remain drafts. Teacher goals are unset until the teacher saves them. Goal/evidence changes make prior brief context visibly stale without erasing history.

The existing OpenRouter free text model powers live answers and briefs. A teacher may select live assistance while retaining sample worksheet readings; both sources remain labeled separately. Sample answers are explicitly identified and generated from current saved data. Provider failures produce visible errors with no silent sample or paid-model fallback.

Conversation and goals persist in local storage or the existing Supabase owner-scoped state. The additive migration preserves existing data and access controls. Requests are bounded and idempotent; model calls occur outside storage transactions; results generated against changed context are rejected or explicitly marked stale.

## Acceptance

- Suggestions lead to exact evidence, the matching teacher review, and the correct lesson.
- The student matrix, pattern counts and comparison views reconcile with the current assignment slots and retain unknown/missing distinctions.
- A complete lesson plan can be read and printed, including timing, actual tasks and assessment guidance. Teacher edits and accepted groups are preserved.
- Chat can answer a classroom question, follow up about a student, refer to the selected lesson and saved goals, and provide working citations. Refresh preserves the conversation.
- Live and sample responses are labeled; unknown sources, cross-owner references, invalid output and provider failures cannot mutate classroom decisions.
- Existing upload, correction, review, planning, history and print flows continue to pass, including mobile and keyboard checks.

Implementation uses the existing Next.js, Supabase and direct OpenRouter boundaries. No new charting library or external assistant data store is required.
