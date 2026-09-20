import type { AppState, EvidenceRef, LessonBlock, LessonLane, Material, PlanVersion, Rational } from './contracts';
import { curriculum } from './curriculum';
import { selectResponseRevision } from './analytics';

export type GuideQuestion = { prompt: string; expectedResponse: string };
export type GuideTask = { id: string; prompt: string; answer: string; operands?: Rational[]; expected?: Rational; unit?: string | null };
export type GuideSupport = {
  moves: string[];
  questions: GuideQuestion[];
  tasks: GuideTask[];
  workedExample?: GuideTask & { steps: string[]; comparison?: string };
  collect?: string;
};
export type GuideLane = {
  id: string; title: string; minutes: number; teacherLed: boolean;
  students: { id: string; name: string }[];
  entryCheckStudents: { id: string; name: string }[];
  savedInstructions: string;
  materials: { id: string; title: string; tasks: GuideTask[]; conditions?: string; teacherPrompts: string[] }[];
  missingMaterialIds: string[];
};
export type GuideBlock = {
  blockId: string; title: string; minutes: number; startMinute: number; endMinute: number;
  savedInstructions: string; mode: LessonBlock['mode'];
  support?: GuideSupport; custom: boolean; lanes: GuideLane[];
  materials: GuideLane['materials']; missingMaterialIds: string[];
};
export type LessonGuide = {
  lessonId: string; versionId: string; versionNumber: number; title: string; date: string;
  totalMinutes: number; objectives: string[]; successCriteria: string[];
  vocabulary: { term: string; meaning: string }[]; preparation: string[]; materials: string[];
  sequence: GuideBlock[]; nextSteps: { observation: string; action: string }[];
  source: { label: string; href: string } | null;
  rationale: { text: string; mode: 'fixture' | 'live'; teacherEdited: boolean }[];
  evidence: { ref: EvidenceRef; label: string; href: string | null }[];
  disclosure: string; assessmentDate: string; materialsHref: string | null;
  studentDownloads: { title: string; href: string }[];
};

const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const f = (n: number, d: number): Rational => ({ numerator: n, denominator: d });
const fraction = (value: Rational) => `${value.numerator}/${value.denominator}`;
/** Arithmetic is constructed from operands so display steps and teacher keys agree. */
function example(id: string, prompt: string, a: Rational, b: Rational, unit: string | null = 'meter', compare = false): GuideSupport['workedExample'] & GuideTask {
  const denominator = a.denominator * b.denominator / gcd(a.denominator, b.denominator);
  const an = a.numerator * denominator / a.denominator, bn = b.numerator * denominator / b.denominator;
  const divisor = gcd(an + bn, denominator), expected = f((an + bn) / divisor, denominator / divisor);
  const final = `${fraction(expected)}${unit ? ` ${unit}` : ''}`;
  return {
    id, prompt, operands: [a, b], expected, unit, answer: final,
    steps: [
      `${fraction(a)} = ${an}/${denominator}; ${fraction(b)} = ${bn}/${denominator}. Both fractions now use parts from a whole divided into ${denominator} equal pieces.`,
      `${an}/${denominator} + ${bn}/${denominator} = ${an + bn}/${denominator}${divisor > 1 ? ` = ${fraction(expected)}` : ''}.`,
      `${unit ? `The total length is ${final}. ` : `The total is ${final}. `}It is greater than each positive addend and less than one whole.`,
    ],
    ...(compare ? { comparison: `A second valid denominator is ${2 * denominator}: ${2 * an}/${2 * denominator} + ${2 * bn}/${2 * denominator} = ${2 * (an + bn)}/${2 * denominator}. This is equivalent to ${fraction(expected)}; a least common denominator is convenient, not required.` } : {}),
  };
}
const q = (prompt: string, expectedResponse: string): GuideQuestion => ({ prompt, expectedResponse });
const task = (id: string, a: Rational, b: Rational, context = 'Two pieces of ribbon measure'): GuideTask => example(id, `${context} ${fraction(a)} meter and ${fraction(b)} meter. Find the total length. Show equivalent fractions and include the unit.`, a, b);
const explain = (id: string, prompt: string, answer: string): GuideTask => ({ id, prompt, answer });

type Blueprint = { focus: string; recall: GuideQuestion; example: NonNullable<GuideSupport['workedExample']>; guided: GuideTask[]; independent: GuideTask[]; exit: GuideTask[]; modelMoves: string[]; comparison?: boolean };
const blueprints: Record<string, Blueprint> = {
  'lesson-2026-09-23': {
    focus: 'Connect a ribbon-length problem to equal parts, a calculation, and a labeled answer.',
    recall: q('On equal-length bars, shade 1/2 and 2/4. What stayed the same?', 'The shaded length is unchanged. Splitting each half in two creates fourths; one half is two fourths.'),
    example: example('model-sep23', 'A display needs 3/8 meter of blue ribbon and 1/4 meter of green ribbon. How much ribbon is needed altogether?', f(3, 8), f(1, 4)),
    guided: [task('guided-sep23-1', f(1, 6), f(1, 12)), task('guided-sep23-2', f(1, 4), f(3, 8))],
    independent: [task('independent-sep23-1', f(1, 5), f(1, 15)), task('independent-sep23-2', f(1, 3), f(1, 9))],
    exit: [task('exit-sep23', f(1, 8), f(1, 16)), explain('explain-sep23', 'Why must the parts be the same size before you add?', 'The denominator names the size of each part. Rename the fractions into the same-sized parts, then add their counts.')],
    modelMoves: ['Read the problem aloud. Underline “altogether” and “meter”; estimate whether the answer will be above or below one meter.', 'Draw two equal-length bars. Partition both into eighths. Match each shaded part to the written equivalent fraction.', 'Add the counts of eighths. Circle the unchanged denominator and finish with a sentence using meter.'],
  },
  'lesson-2026-09-25': {
    focus: 'Compare two valid common denominators and use a benchmark to check the total.',
    recall: q('Show why 3/6 and 1/2 name the same amount.', 'Three of six equal parts cover half of an equal-sized whole. Regrouping the sixths does not change the amount.'),
    example: example('model-sep25', 'A craft uses 1/6 meter of ribbon, then 1/4 meter more. Find the total in two ways.', f(1, 6), f(1, 4), 'meter', true),
    guided: [task('guided-sep25-1', f(1, 8), f(1, 6)), task('guided-sep25-2', f(1, 4), f(1, 16))],
    independent: [task('independent-sep25-1', f(1, 3), f(1, 12)), task('independent-sep25-2', f(2, 7), f(1, 14))],
    exit: [task('exit-sep25', f(1, 5), f(1, 20)), explain('explain-sep25', 'Explain one check that tells you your total is reasonable.', 'The sum of two positive fractions must exceed each addend. Here 1/4 is greater than 1/5 and 1/20; an equal-whole model also verifies the total.')],
    modelMoves: ['Estimate: each piece is less than half a meter; their total must exceed 1/4 meter and remain below one meter.', 'Write the same addition using twelfths, then twenty-fourths. Ask students to pair each term across the two methods.', 'Accept both 5/12 and 10/24. Ask how regrouping parts explains their equal value.'], comparison: true,
  },
  'lesson-2026-09-28': {
    focus: 'Match each written renaming step to an equal-whole model, then apply it to word problems.',
    recall: q('Shade 2/3 of a bar, then split every third into two parts. What fraction is shaded now?', '4/6. Both the numerator and denominator doubled because every original part was split in two; the amount stayed the same.'),
    example: example('model-sep28', 'Two strips measure 1/3 meter and 1/6 meter. Draw their total and write the matching calculation.', f(1, 3), f(1, 6)),
    guided: [task('guided-sep28-1', f(1, 4), f(1, 16)), task('guided-sep28-2', f(1, 3), f(2, 9))],
    independent: [], // This saved application block explicitly uses the authored Word problems assignment.
    exit: [explain('exit-sep28', 'Explain why 1/3 + 1/6 becomes 2/6 + 1/6. What does the denominator count?', 'Each third is two sixths of the same whole. Both addends now count sixths, so 2/6 + 1/6 = 3/6 = 1/2; the denominator identifies the part size.')],
    modelMoves: ['Start with two equal-length bars. Mark thirds on one and sixths on the other.', 'Split each third into two. Point to two sixths as you write 1/3 = 2/6.', 'Combine the shaded parts, count three sixths, and regroup them as one half. Ask a student to connect every written step to the diagram.'],
  },
  'lesson-2026-09-29': {
    focus: 'Choose a useful common denominator and explain why equivalent unreduced answers are valid.',
    recall: q('Compare 3/5 and 6/10 on equal-sized wholes. Why are they equal?', 'Splitting each fifth in two gives tenths. The count doubles while the part size halves, so the amount stays the same.'),
    example: example('model-sep29', 'A border uses 3/10 meter of ribbon and 1/4 meter more. Compare two ways to calculate its total.', f(3, 10), f(1, 4), 'meter', true),
    guided: [task('guided-sep29-1', f(1, 6), f(1, 8)), task('guided-sep29-2', f(2, 9), f(1, 6))],
    independent: [task('independent-sep29-1', f(1, 4), f(1, 5)), task('independent-sep29-2', f(3, 8), f(1, 6))],
    exit: [task('exit-sep29', f(1, 6), f(1, 9)), explain('explain-sep29', 'State what your common denominator counts and why it stays the same when you add.', 'Eighteenths are equal-sized parts of the same whole. Adding their counts does not change their size; 3/18 + 2/18 = 5/18.')],
    modelMoves: ['Estimate the total before calculating. Both pieces are shorter than half a meter.', 'Show twentieths and fortieths side by side. Ask students to explain why multiplying both parts of each fraction preserves its value.', 'Compare 11/20 and 22/40. Both are valid; choose a denominator that keeps the arithmetic manageable.'], comparison: true,
  },
  'lesson-2026-10-01': {
    focus: 'Make the method inspectable: equivalent fractions, a sensible total, and the context unit.',
    recall: q('Rename 1/3 in sixths and explain why 1/3 + 1/6 cannot be 2/9.', '1/3 = 2/6. The addends count different-sized parts until renamed; 2/9 is smaller than 1/3, so it cannot be this positive sum.'),
    example: example('model-oct01', 'A class joins 2/9 meter of ribbon to 1/6 meter. Write a complete solution someone else can check.', f(2, 9), f(1, 6)),
    guided: [task('guided-oct01-1', f(3, 8), f(1, 6)), task('guided-oct01-2', f(1, 5), f(1, 12))],
    independent: [task('independent-oct01-1', f(2, 7), f(1, 14)), task('independent-oct01-2', f(1, 8), f(1, 3))],
    exit: [task('exit-oct01', f(1, 9), f(1, 6)), explain('explain-oct01', 'Name one step you can explain and one question you still have.', 'Look for a specific step or question, such as why 1/6 = 3/18. Use it for a short teacher conference; do not turn it into a permanent ability label.')],
    modelMoves: ['Read the context, record meter, and estimate an answer below one half.', 'Model each equivalent-fraction step without skipping the common-unit explanation. This is a practice example, not a supplied assessment item.', 'Check the total against the addends and one half. Invite students to name the evidence that makes this a complete solution.'],
  },
};

const resultActions: LessonGuide['nextSteps'] = [
  { observation: 'Correct method and explanation without help', action: 'Keep the next planned application. Offer a second valid denominator or an explain-an-error task, then collect another independent example.' },
  { observation: 'Adds denominators or changes a fraction’s value', action: 'Use equal-length strips in a brief teacher conference. Ask the student to rename one addend and check a fresh example; record any help.' },
  { observation: 'Common-unit method is sound, but arithmetic or unit is missing', action: 'Ask the student to check the numerator calculation and write a sentence with the context unit. Keep this feedback specific to the observed step.' },
  { observation: 'Blank, unclear, or completed with help', action: 'Ask a short follow-up question or collect a new independent attempt. Record “not enough evidence” or the support given; do not infer an independent success or a misconception from a blank.' },
];

function materialTasks(material: Material): GuideTask[] {
  return material.prompts.map(prompt => ({ id: prompt.id, prompt: prompt.prompt, answer: prompt.answerKey, operands: prompt.operands, expected: prompt.expectedRational ?? undefined, unit: prompt.answerUnit }));
}
function guideMaterials(ids: string[], pool: Material[]): { materials: GuideLane['materials']; missingMaterialIds: string[] } {
  return {
    materials: ids.flatMap(id => { const material = pool.find(m => m.id === id); return material ? [{ id, title: material.title, tasks: materialTasks(material), conditions: material.conditions, teacherPrompts: material.teacherPrompts ?? [] }] : []; }),
    missingMaterialIds: ids.filter(id => !pool.some(m => m.id === id)),
  };
}
function sourceFor(state: AppState, version: PlanVersion): LessonGuide['source'] {
  const visited = new Set<string>();
  let current: PlanVersion | undefined = version;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.sourceAssetId) return { label: 'Original imported lesson', href: `/api/assets/${encodeURIComponent(current.sourceAssetId)}?variant=original` };
    current = state.planVersions.find(v => v.id === current?.previousVersionId);
  }
  return curriculum.lessons.some(lesson => lesson.lessonId === version.lessonId)
    ? { label: 'Original authored lesson PDF', href: `/demo/${version.lessonId}-original.pdf` } : null;
}
function authoredSupport(block: LessonBlock, blueprint: Blueprint, date: string): GuideSupport {
  switch (block.id) {
    case 'warmup': return { moves: ['Give everyone quiet think-and-draw time, then compare two explanations.', 'Check that diagrams use equal-sized wholes. Ask students to name the part size before counting shaded parts.'], questions: [blueprint.recall], tasks: [] };
    case 'model': return { moves: blueprint.modelMoves, questions: [q('Why can we add these numerators now?', 'The renamed fractions count the same-sized parts of an equal whole.'), q('Why does the denominator stay the same?', 'The size of each part stays the same; we are adding how many of those parts we have.')], tasks: [], workedExample: blueprint.example };
    case 'practice': return { moves: ['First 2 minutes: set up the first problem together and name a possible common unit.', `Next 7 minutes: pairs solve both tasks. One draws or calculates; the other checks ${blueprint.comparison ? 'a second common denominator and the value of the total' : 'equal-sized parts and every renaming step'}. Switch roles for task 2.`, 'Final 3 minutes: compare one explanation. Record the actual help given instead of assigning a fixed ability label.'], questions: [q('Where can I see the same quantity written in a different unit?', 'Point to a correct equivalent-fraction step and explain how the whole is repartitioned.')], tasks: blueprint.guided };
    case 'application': {
      const assignment = date === '2026-09-28' ? curriculum.materials.find(m => m.id === 'word-problems-template-v1') : undefined;
      return {
        moves: assignment ? ['First 10 minutes: give each student the three-question Word problems page. Let them begin independently; record any assistance accurately.', 'Final 5 minutes: discuss how the context determines the unit. Keep the original work and support record for later review.'] : ['First 2 minutes: read the task directions and clarify vocabulary without supplying the calculation.', 'Next 10 minutes: students solve individually. Circulate, note the exact step you observe, and record any prompt or model provided.', 'Final 3 minutes: ask partners to compare their explanations. Keep the initial individual attempt distinguishable from any later supported revision.'],
        questions: [q('What does your answer measure, and how do you know it is reasonable?', 'It measures a total length in meters. The positive sum exceeds each piece; a model or benchmark checks its size.')],
        tasks: assignment ? materialTasks(assignment) : blueprint.independent,
        collect: assignment ? 'Use the Word problems assignment to attach this dated work and the help provided. Do not compare its score directly with a calculation-only task as proof of growth.' : 'Collect the initial individual working. Note whether the student used a model, a prompt, peer help, or no help.',
      };
    }
    case 'exit': return { moves: ['First 3 minutes: students respond on a fresh slip independently. Read the directions without demonstrating the solution.', 'Final 2 minutes: collect the slips and sort by the observed step. Ask for clarification later if the writing is unclear.'], questions: [], tasks: blueprint.exit, collect: 'Use the response and recorded support to choose a next check. Keep the October 2 assessment date fixed.' };
    default: return { moves: [], questions: [], tasks: [] };
  }
}

/** A read-only teaching view. Saved instructions, allocations and named groups always win. */
export function buildLessonGuide(state: AppState, version: PlanVersion): LessonGuide {
  const snapshot = version.snapshot;
  const authored = curriculum.lessons.find(lesson => lesson.lessonId === snapshot.lessonId && lesson.unitId === snapshot.unitId);
  const blueprint = authored ? blueprints[snapshot.lessonId] : undefined;
  const materialSet = state.materialSets.find(set => set.planVersionId === version.id);
  // An accepted version uses its frozen material set, never a newer runtime copy.
  const pool = materialSet?.materials ?? curriculum.materials;
  const name = (id: string) => ({ id, name: state.students.find(student => student.id === id)?.displayName ?? id });
  const lane = (item: LessonLane): GuideLane => ({
    id: item.id, title: item.title, minutes: item.minutes, teacherLed: item.teacherLed,
    students: item.studentIds.map(name), entryCheckStudents: item.entryCheckStudentIds.map(name), savedInstructions: item.instructions,
    ...guideMaterials(item.materialIds, pool),
  });
  let minute = 0;
  const sequence: GuideBlock[] = snapshot.blocks.map(block => {
    const base = authored?.blocks.find(item => item.id === block.id);
    // Supplemental routines only attach to the exact authored block. Custom edits get no guessed script.
    const unchanged = !!base && JSON.stringify(block) === JSON.stringify(base);
    const startMinute = minute; minute += block.minutes;
    return { blockId: block.id, title: block.title, minutes: block.minutes, startMinute, endMinute: minute, savedInstructions: block.instructions, mode: block.mode, custom: !unchanged,
      ...(unchanged && blueprint ? { support: authoredSupport(block, blueprint, snapshot.date) } : {}),
      lanes: (block.lanes ?? []).map(lane), ...guideMaterials(block.materialIds ?? [], pool),
    };
  });
  const hasWordProblemsTask = snapshot.date === "2026-09-28" && !!sequence.find(block => block.blockId === "application")?.support;
  const proposal = state.proposals.find(item => item.id === version.proposalId);
  const selectedChanges = proposal?.changes.filter(change => version.selectedChangeIds.includes(change.id)) ?? [];
  const evidence = version.evidence.map(ref => {
    const reading = selectResponseRevision(state, ref.responseId, ref.responseRevision);
    const submission = state.submissions.find(item => item.id === reading?.submissionId);
    const student = state.students.find(item => item.id === submission?.studentId);
    const observation = state.observations.filter(item => item.createdAt <= version.createdAt && item.evidence.some(e => e.responseId === ref.responseId && e.responseRevision === ref.responseRevision)).at(-1);
    return { ref: { ...ref }, label: `${student?.displayName ?? 'Student'} · ${reading?.questionId ?? 'saved answer'} · reading ${ref.responseRevision}`, href: submission ? `/review/${submission.batchId}?response=${encodeURIComponent(ref.responseId)}&revision=${ref.responseRevision}${observation ? `&observation=${observation.id}` : ''}#answer-inspector` : null };
  });
  return {
    lessonId: snapshot.lessonId, versionId: version.id, versionNumber: version.versionNumber, title: snapshot.title, date: snapshot.date, totalMinutes: minute,
    objectives: snapshot.objectiveIds.map(id => curriculum.objectives.find(item => item.id === id)?.description ?? id),
    successCriteria: blueprint ? ['I keep the whole the same size when I rename a fraction.', 'I show a common fractional unit, add its counts, and keep the denominator.', 'I explain my method, check that the total makes sense, and label the context unit.'] : [],
    vocabulary: blueprint ? [{ term: 'Equivalent fractions', meaning: 'Different fraction names for the same quantity.' }, { term: 'Common denominator', meaning: 'A shared denominator that names equal-sized fractional parts.' }, { term: 'Numerator', meaning: 'The number of those equal-sized parts.' }, { term: 'Context unit', meaning: 'What the amount measures, such as meter.' }] : [],
    materials: blueprint ? ['Equal-length fraction strips or blank equal-whole bars', 'Board and markers; paper or mini-whiteboards', 'Pencils and fresh exit slips', ...(hasWordProblemsTask ? ['Word problems assignment: one blank copy per student'] : []), ...new Set(sequence.flatMap(block => [...block.materials, ...block.lanes.flatMap(item => item.materials)]).map(item => item.title))] : [],
    preparation: blueprint ? [blueprint.focus, 'Draw equal-sized wholes before class. Keep worked answers on the teacher copy until students have attempted each task.', 'Prepare a note sheet with space for the date, task, observed step, and help provided. Use only the named groups saved below; otherwise begin with the whole class.'] : ['Use the saved instructions below. This imported or custom lesson has no matching authored teaching script.'],
    sequence, nextSteps: blueprint ? resultActions.map(item => ({ ...item })) : [], source: sourceFor(state, version),
    rationale: selectedChanges.map(change => ({ text: change.rationale, mode: proposal!.provenance.mode, teacherEdited: proposal!.teacherEdited })), evidence,
    disclosure: 'Teaching examples and prompts are authored curriculum guidance, not live AI output. Timings, instructions, named groups, and saved material selections come from this exact lesson version. Edited or unfamiliar blocks retain their saved instructions without an invented replacement script.',
    assessmentDate: curriculum.unit.fixedAssessmentDate,
    materialsHref: materialSet ? `/materials/${version.id}` : null,
    studentDownloads: hasWordProblemsTask ? [{ title: "Blank Word problems page", href: "/demo/word-problems-template-v1.pdf" }] : [],
  };
}
