import { describe, expect, it } from 'vitest';
import { buildLessonGuide, type GuideTask } from '../../lib/lesson-guide';
import { assignments } from '../../lib/assignments';
import { curriculum } from '../../lib/curriculum';
import { analyzeBatch, applyProposal, createInitialState, generateProposal, reviewFindings } from '../../lib/domain';
import { seedAssignment, testProvenance } from './helpers';

function accepted() {
  const state = createInitialState('teacher');
  const batch = seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-01', 'stu-04'] });
  const findings = analyzeBatch(state, { batchId: batch.id, provenance: testProvenance });
  reviewFindings(state, { items: findings.map(f => ({ findingId: f.id, expectedRevision: f.revision, decision: 'confirm' })), acknowledgeClearReadings: true });
  const plan = state.plans.find(p => p.id === 'lesson-2026-09-23')!;
  const proposal = generateProposal(state, plan.id, { basePlanVersionId: plan.currentVersionId, expectedEvidenceRevision: state.classroom.evidenceRevision, expectedCalendarRevision: state.classroom.calendarRevision, provenance: testProvenance });
  const result = applyProposal(state, proposal.id, { expectedRevision: proposal.revision, basePlanVersionId: proposal.basePlanVersionId, expectedEvidenceRevision: proposal.evidenceRevision, expectedCalendarRevision: proposal.calendarRevision, selectedChangeIds: proposal.changes.map(c => c.id) });
  const version = state.planVersions.find(v => v.id === result.planVersionId)!;
  return { state, version, proposal };
}
function checkTask(task: GuideTask) {
  if (!task.operands?.length || !task.expected) return;
  const [a, b] = task.operands;
  expect((a.numerator * b.denominator + b.numerator * a.denominator) * task.expected.denominator).toBe(task.expected.numerator * a.denominator * b.denominator);
  expect(task.expected.numerator).toBeGreaterThan(0);
  expect(task.expected.numerator).toBeLessThanOrEqual(task.expected.denominator);
  if (task.unit) expect(task.answer).toContain(task.unit);
}

describe('complete teacher lesson guides', () => {
  it('provides five distinct teachable 45-minute guides without changing saved state', () => {
    const state = createInitialState('teacher'), before = JSON.stringify(state);
    const examples = new Set<string>();
    for (const assignment of assignments) {
      const version = state.planVersions.find(v => v.lessonId === assignment.targetLessonId)!;
      const guide = buildLessonGuide(state, version);
      expect(guide.totalMinutes).toBe(45);
      expect(guide.sequence.map(b => [b.startMinute, b.endMinute])).toEqual([[0, 5], [5, 13], [13, 25], [25, 40], [40, 45]]);
      expect(guide.sequence.map(b => b.savedInstructions)).toEqual(version.snapshot.blocks.map(b => b.instructions));
      expect(guide.sequence.every(b => b.support && !b.custom)).toBe(true);
      expect(guide.sequence.find(b => b.blockId === 'practice')!.support!.tasks).toHaveLength(2);
      expect(guide.sequence.find(b => b.blockId === 'application')!.support!.tasks.length).toBeGreaterThanOrEqual(2);
      expect(guide.sequence.find(b => b.blockId === 'exit')!.support!.tasks.length).toBeGreaterThan(0);
      expect(guide.successCriteria).toHaveLength(3);
      expect(guide.assessmentDate).toBe('2026-10-02');
      expect(guide.disclosure).toContain('not live AI output');
      const example = guide.sequence.find(b => b.blockId === 'model')!.support!.workedExample!;
      examples.add(example.prompt);
      checkTask(example);
      for (const block of guide.sequence) block.support!.tasks.forEach(checkTask);
    }
    expect(examples.size).toBe(5);
    expect(JSON.stringify(state)).toBe(before);
  });
  it('preserves custom instructions and unfamiliar blocks without substituting an authored routine', () => {
    const state = createInitialState('teacher'), version = state.planVersions[0];
    version.snapshot.title = 'My revised lesson';
    version.snapshot.blocks[0] = { id: 'teacher-conference', title: 'Discuss yesterday’s drawing', minutes: 7, instructions: 'Use my annotated diagram. Ask Mira to explain the dotted line.', mode: 'whole_class' };
    version.snapshot.blocks[1].minutes = 6;
    version.snapshot.blocks[2].instructions = 'Use the teacher-created ribbon task, not the default paired task.';
    const guide = buildLessonGuide(state, version);
    expect(guide.title).toBe('My revised lesson');
    expect(guide.totalMinutes).toBe(45);
    expect(guide.sequence[0]).toMatchObject({ blockId: 'teacher-conference', title: 'Discuss yesterday’s drawing', startMinute: 0, endMinute: 7, savedInstructions: version.snapshot.blocks[0].instructions, custom: true });
    expect(guide.sequence[0].support).toBeUndefined();
    expect(guide.sequence[1].support).toBeUndefined();
    expect(guide.sequence[2].savedInstructions).toBe(version.snapshot.blocks[2].instructions);
    expect(guide.sequence[2].support).toBeUndefined();
    expect(guide.sequence[3].support).toBeDefined();
  });
  it('uses only saved group memberships and frozen material prompts after accepting changes', () => {
    const { state, version, proposal } = accepted();
    const lane = version.snapshot.blocks.find(b => b.id === 'practice')!.lanes![0];
    const set = state.materialSets.find(m => m.planVersionId === version.id)!;
    const material = set.materials.find(m => m.id === lane.materialIds[0])!;
    material.prompts[0].prompt = 'Frozen teacher-edited material prompt';
    material.prompts[0].answerKey = 'Frozen teacher key';
    // A later unsaved suggestion is deliberately different and must not enter the guide.
    const practice = proposal.changes.find(c => c.operation === 'replace_practice')!;
    if (practice.operation === 'replace_practice') practice.payload.block.lanes![0].studentIds = ['stu-08'];
    const guide = buildLessonGuide(state, version), block = guide.sequence.find(b => b.blockId === 'practice')!;
    expect(block.support).toBeUndefined();
    expect(block.lanes[0].students.map(s => s.id)).toEqual(lane.studentIds);
    expect(block.lanes[0].students.map(s => s.name)).toEqual(lane.studentIds.map(id => state.students.find(s => s.id === id)!.displayName));
    expect(block.lanes[0].materials[0].tasks[0]).toMatchObject({ prompt: 'Frozen teacher-edited material prompt', answer: 'Frozen teacher key' });
    expect(guide.materialsHref).toBe(`/materials/${version.id}`);
    expect(guide.rationale.every(r => r.mode === 'fixture')).toBe(true);
    expect(guide.evidence.length).toBeGreaterThan(0);
  });
  it('keeps a selected historical guide independent of later saved plan versions', () => {
    const { state, version } = accepted();
    const original = state.planVersions.find(v => v.id === version.previousVersionId)!;
    const before = buildLessonGuide(state, original);
    version.snapshot.blocks[0].instructions = 'A later saved edit';
    expect(buildLessonGuide(state, original)).toEqual(before);
    expect(before.sequence.every(b => b.lanes.length === 0)).toBe(true);
    expect(before.materialsHref).toBeNull();
  });
  it('links the imported original through version ancestry and the exact saved evidence reading', () => {
    const { state, version } = accepted();
    const original = state.planVersions.find(v => v.id === version.previousVersionId)!;
    original.sourceAssetId = 'private-import';
    const guide = buildLessonGuide(state, version);
    expect(guide.source).toEqual({ label: 'Original imported lesson', href: '/api/assets/private-import?variant=original' });
    for (const evidence of guide.evidence) expect(evidence.href).toContain(`revision=${evidence.ref.responseRevision}`);
    expect(guide.evidence.map(e => e.ref)).toEqual(version.evidence);
  });
  it('uses original source files and preserves the scheduled ten-minute Word problems task', () => {
    const state = createInitialState('teacher');
    for (const version of state.planVersions) expect(buildLessonGuide(state, version).source?.href).toBe(`/demo/${version.lessonId}-original.pdf`);
    const guide = buildLessonGuide(state, state.planVersions.find(v => v.lessonId === 'lesson-2026-09-28')!);
    const application = guide.sequence.find(b => b.blockId === 'application')!;
    expect(application.support!.moves[0]).toContain('First 10 minutes');
    expect(application.support!.moves[1]).toContain('Final 5 minutes');
    expect(application.support!.tasks.map(t => t.id)).toEqual(curriculum.templates.find(t => t.id === 'word-problems-template-v1')!.questionIds);
  });
  it('does not silently substitute current materials for a missing saved material', () => {
    const { state, version } = accepted();
    const set = state.materialSets.find(m => m.planVersionId === version.id)!;
    set.materials = [];
    const guide = buildLessonGuide(state, version), practice = guide.sequence.find(b => b.blockId === 'practice')!;
    expect(practice.lanes[0].materials).toEqual([]);
    expect(practice.lanes[0].missingMaterialIds.length).toBeGreaterThan(0);
  });
});
