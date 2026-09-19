import { z } from 'zod';
import { analysisSchema, applyProposalSchema, candidateFindingSchema, confirmLessonImportSchema, correctResponseSchema, correctSupportSchema, createBatchSchema, editFindingSchema, editProposalSchema, extractionSchema, generateProposalSchema, lessonSchema, proposalChangeSchema, reviewFindingsSchema, type AppState, type Batch, type CandidateFindingDraft, type EvidenceRef, type Finding, type LessonSnapshot, type Material, type PlanVersion, type Proposal, type ProposalChange, type Provenance, type Response, type SupportSnapshot } from '../contracts';
import { curriculum, getQuestion, getTemplate } from '../curriculum';
import { CATALOG_VERSION, getAssignment } from '../assignments';
import { getCurrentSkillFindings, selectEffectiveSubmissions } from '../analytics';
import { addFractions, checkMath, equalFractions } from './math';
import { invariant } from './errors';
export { DomainError } from './errors';
export * from './math';
export { upgradeCatalog } from './catalog';
export type DomainContext = { actorId?: string; now?: string; makeId?: (prefix: string) => string; idempotencyKey?: string };
const clone = <T>(value: T): T => structuredClone(value);
const now = (ctx: DomainContext = {}) => ctx.now || new Date().toISOString();
const id = (prefix: string, ctx: DomainContext = {}) => ctx.makeId?.(prefix) || `${prefix}-${globalThis.crypto.randomUUID()}`;
const base = (state: AppState, prefix: string, ctx: DomainContext = {}) => ({ id: id(prefix, ctx), ownerId: state.ownerId, createdAt: now(ctx) });
const mutable = (state: AppState, prefix: string, ctx: DomainContext = {}) => ({ ...base(state, prefix, ctx), revision: 1, updatedAt: now(ctx) });
function touch(entity: { revision: number; updatedAt: string }, ctx: DomainContext) { entity.revision++; entity.updatedAt = now(ctx); }
function find<T extends {id: string}>(items: T[], entityId: string): T { const entity = items.find(item => item.id === entityId); invariant(entity, 'NOT_FOUND', 'The requested record does not exist.', 404); return entity; }
function expected(entity: { revision: number }, revision: number) { invariant(entity.revision === revision, 'REVISION_CONFLICT', 'This record changed. Refresh before saving.', 409); }
function audit(state: AppState, action: string, entityId: string, details: Record<string, unknown>, ctx: DomainContext = {}) { const event = { ...base(state, 'audit', ctx), actorId: ctx.actorId || state.ownerId, action, entityId, details }; state.auditEvents.push(event); return event; }
function invalidateProposals(state: AppState, ctx: DomainContext) { state.classroom.evidenceRevision++; touch(state.classroom, ctx); for (const proposal of state.proposals) if (proposal.status === 'draft') { proposal.status = 'stale'; touch(proposal, ctx); } }
function withdrawObservations(state: AppState, findingId: string, reason: string) { for (const observation of state.observations) if (observation.findingId === findingId && !observation.superseded) { observation.superseded = true; observation.supersededReason = reason; } }
function invalidateEvidence(state: AppState, responseIds: string[], submissionIds: string[], reason: string, ctx: DomainContext) {
  for (const finding of state.findings) if (finding.evidence.some(ref => responseIds.includes(ref.responseId)) || finding.supportSnapshots.some(s => submissionIds.includes(s.submissionId))) {
    if (finding.status !== 'rejected') { finding.status = 'stale'; touch(finding, ctx); withdrawObservations(state, finding.id, reason); }
  }
  invalidateProposals(state, ctx);
}
export function inputFingerprint(state: AppState, batchId?: string): string {
  const responses = state.responses.filter(r => !batchId || state.submissions.some(s => s.id === r.submissionId && s.batchId === batchId));
  return JSON.stringify({ catalog: CATALOG_VERSION, savedCatalog: state.classroom.catalogVersion ?? 1, owner: state.ownerId, batch: batchId ? find(state.batches, batchId).revision : null, evidence: state.classroom.evidenceRevision, calendar: state.classroom.calendarRevision, responses: responses.map(r => [r.id, r.revision]), submissions: state.submissions.filter(s => !batchId || s.batchId === batchId).map(s => [s.id, s.revision]), plans: state.plans.map(p => [p.id,p.currentVersionId]) });
}
export function createInitialState(ownerId: string): AppState {
  const time = new Date().toISOString();
  const state: AppState = { schemaVersion: 1, ownerId, revision: 1, classroom: { id: curriculum.classroom.id, ownerId, createdAt: time, updatedAt: time, revision: 1, name: curriculum.classroom.name, grade: 5, subject: 'Mathematics', timezone: 'America/Chicago', evidenceRevision: 1, calendarRevision: 1, unitId: curriculum.unit.id }, students: curriculum.roster.map(s => ({ ...s, ownerId, createdAt: time, classroomId: curriculum.classroom.id, active: true })), batches: [], submissions: [], assets: [], extractions: [], responses: [], readingReviews: [], responseRevisions: [], findings: [], observations: [], plans: [], planVersions: [], proposals: [], materialSets: [], calendarEntries: [], jobs: [], auditEvents: [], mutationKeys: [], lessonImports: [] };
  state.classroom.catalogVersion = CATALOG_VERSION;
  for (const lesson of curriculum.lessons) {
    const versionId = `${lesson.lessonId}-original`;
    state.plans.push({ id: lesson.lessonId, ownerId, createdAt: time, updatedAt: time, revision: 1, unitId: lesson.unitId, date: lesson.date, title: lesson.title, currentVersionId: versionId });
    state.planVersions.push({ id: versionId, ownerId, createdAt: time, lessonId: lesson.lessonId, versionNumber: 1, previousVersionId: null, snapshot: clone(lesson), proposalId: null, selectedChangeIds: [], evidence: [], actorId: ownerId });
  }
  state.calendarEntries = curriculum.calendar.map(entry => ({ id: entry.id, ownerId, createdAt: time, updatedAt: time, revision: 1, unitId: curriculum.unit.id, date: entry.date, title: entry.title, instructions: entry.content, kind: entry.eventType, minutes: entry.minutes, locked: entry.locked, objectiveIds: entry.learningObjectiveIds, prerequisiteEntryIds: entry.prerequisiteCalendarEntryIds, ...(entry.lessonId ? { lessonId: entry.lessonId, planVersionId: `${entry.lessonId}-original` } : {}) }));
  for (const entry of curriculum.widerCalendar) state.calendarEntries.push({ id: entry.id, ownerId, createdAt: time, updatedAt: time, revision: 1, unitId: 'next-unit-preview', date: entry.startDate, endDate: entry.endDate, title: entry.title, instructions: entry.detail, kind: 'next-unit-preview', minutes: 0, locked: entry.locked, objectiveIds: entry.learningObjectiveIds, prerequisiteEntryIds: entry.prerequisiteCalendarEntryIds, preview: true });
  return state;
}
export function createBatch(state: AppState, raw: z.input<typeof createBatchSchema>, ctx: DomainContext = {}): Batch {
  const input = createBatchSchema.parse(raw), template = getTemplate(input.templateId), assignment = getAssignment(input.templateId);
  invariant(input.submissions.length === new Set(input.submissions.map(s => s.studentId)).size, 'DUPLICATE_STUDENT', 'Map each student once in a batch.');
  invariant(template.date === input.activityDate, 'ACTIVITY_DATE', 'Use the teaching date on the selected worksheet template.');
  invariant(assignment && input.kind === assignment.kind, 'TEMPLATE_KIND', 'Template and assignment type must agree.');
  if (input.sourcePlanVersionId) find(state.planVersions, input.sourcePlanVersionId);
  if (input.previousBatchId) invariant(find(state.batches, input.previousBatchId).activityDate < input.activityDate,'PREVIOUS_ASSIGNMENT','Prior work must be from an earlier assignment.');
  for (const mapping of input.submissions) { invariant(find(state.students,mapping.studentId).active, 'INACTIVE_STUDENT', 'Only active students can be mapped.'); const asset = find(state.assets,mapping.assetId); invariant(asset.status === 'ready' && asset.purpose === 'worksheet', 'ASSET_NOT_READY', 'Upload a ready worksheet first.'); invariant(!asset.templateId || asset.templateId === input.templateId, 'ASSET_TEMPLATE', 'The asset belongs to another worksheet template.'); }
  const batch: Batch = { ...mutable(state,'batch',ctx), classroomId: state.classroom.id, templateId: input.templateId, activityDate: input.activityDate, kind: input.kind, title: input.title || template.title, submissionIds: [], sourcePlanVersionId: input.sourcePlanVersionId, previousBatchId: input.previousBatchId };
  const previousAttempts = selectEffectiveSubmissions(state, input.templateId);
  for (const mapping of input.submissions) { const previous = previousAttempts.find(s => s.studentId === mapping.studentId); const submission = { ...mutable(state,'submission',ctx), batchId: batch.id, studentId: mapping.studentId, assetId: mapping.assetId, support: clone(mapping.support), ...(previous ? { supersedesSubmissionId: previous.id } : {}) }; state.submissions.push(submission); batch.submissionIds.push(submission.id); }
  state.batches.push(batch); invalidateProposals(state,ctx); audit(state,'batch.created',batch.id,{ studentCount: batch.submissionIds.length },ctx); return batch;
}
export function ingestExtraction(state: AppState, input: { submissionId: string; draft: unknown; provenance: Provenance; assetHash: string }, ctx: DomainContext = {}) {
  const submission = find(state.submissions,input.submissionId), batch = find(state.batches,submission.batchId), draft = extractionSchema.parse(input.draft), template = getTemplate(batch.templateId);
  invariant(draft.templateId === batch.templateId && draft.responses.length === template.questionIds.length && new Set(draft.responses.map(r => r.questionId)).size === template.questionIds.length && draft.responses.every(r => template.questionIds.includes(r.questionId)), 'EXTRACTION_QUESTIONS', 'Extraction must include each known question exactly once.');
  const existing = state.extractions.find(e => e.submissionId === submission.id && e.assetHash === input.assetHash && e.provenance.inputFingerprint === input.provenance.inputFingerprint);
  if (existing) return existing;
  const extraction = { ...base(state,'extraction',ctx), submissionId: submission.id, assetHash: input.assetHash, templateId: batch.templateId, raw: clone(draft), provenance: clone(input.provenance) };
  state.extractions.push(extraction);
  for (const answer of draft.responses) {
    if (state.responses.some(r => r.submissionId === submission.id && r.questionId === answer.questionId)) continue; // Saved teacher-effective readings always win over a re-extraction.
    state.responses.push({ ...mutable(state,'response',ctx), ...answer, submissionId: submission.id, extractionId: extraction.id, mathCheck: checkMath(getQuestion(answer.questionId),answer.workingText,answer.answerText,answer.legibility), readingStatus: 'unreviewed' });
  }
  return extraction;
}
export function correctResponse(state: AppState, responseId: string, raw: z.input<typeof correctResponseSchema>, ctx: DomainContext = {}) {
  const input = correctResponseSchema.parse(raw), response = find(state.responses,responseId); expected(response,input.expectedRevision);
  const before = clone(response); Object.assign(response,{ workingText: input.workingText, answerText: input.answerText, legibility: input.legibility, readingStatus: input.readingStatus }); touch(response,ctx);
  if (input.legibility !== 'uncertain') { response.alternatives = []; response.uncertaintyNote = null; }
  response.mathCheck = checkMath(getQuestion(response.questionId),response.workingText,response.answerText,response.legibility);
  if (input.readingStatus === 'resolved') state.readingReviews.push({ ...base(state,'reading',ctx), responseId, responseRevision: response.revision, actorId: ctx.actorId || state.ownerId, note: input.reason });
  state.responseRevisions.push({ ...base(state,'response-revision',ctx), responseId, before, after: clone(response), actorId: ctx.actorId || state.ownerId, reason: input.reason });
  invalidateEvidence(state,[responseId],[],input.reason,ctx); audit(state,'response.corrected',responseId,{ fromRevision: before.revision, toRevision: response.revision, reason: input.reason },ctx); return response;
}
export function correctSupport(state: AppState, submissionId: string, raw: z.input<typeof correctSupportSchema>, ctx: DomainContext = {}) {
  const input = correctSupportSchema.parse(raw), submission = find(state.submissions,submissionId); expected(submission,input.expectedRevision);
  const before = clone(submission.support); submission.support = { ...input.support, source: 'teacher-corrected' }; touch(submission,ctx); invalidateEvidence(state,[],[submissionId],input.reason,ctx);
  audit(state,'support.corrected',submissionId,{ before, after: submission.support, revision: submission.revision, reason: input.reason },ctx); return submission;
}
function resolveEvidence(state: AppState, draft: CandidateFindingDraft): Response[] {
  invariant(curriculum.objectives.some(o => o.id === draft.objectiveId), 'UNKNOWN_OBJECTIVE', 'Choose an authored learning objective.');
  find(state.students,draft.studentId);
  invariant(new Set(draft.evidence.map(r => r.responseId)).size === draft.evidence.length, 'DUPLICATE_EVIDENCE', 'Cite each answer once.');
  return draft.evidence.map(ref => { const response = find(state.responses,ref.responseId), submission = find(state.submissions,response.submissionId); invariant(submission.studentId === draft.studentId, 'EVIDENCE_OWNER', 'Evidence must belong to this student.'); expected(response,ref.responseRevision); return getEffectiveResponse(state,response); });
}
function evidenceForBatch(state: AppState, draft: CandidateFindingDraft, batchId: string): Response[] {
  const responses = resolveEvidence(state,draft), batch = find(state.batches,batchId);
  invariant(responses.some(r => find(state.submissions,r.submissionId).batchId === batchId),'FINDING_BATCH','A finding must cite at least one response from its own worksheet batch.');
  invariant(responses.every(r => find(state.batches,find(state.submissions,r.submissionId).batchId).activityDate <= batch.activityDate),'FUTURE_EVIDENCE','A dated finding cannot use work collected after that worksheet batch.');
  invariant(responses.some(r => getQuestion(r.questionId).learningObjectiveIds.includes(draft.objectiveId)),'OBJECTIVE_EVIDENCE','The cited work must assess the selected learning objective.');
  return responses;
}
function snapshots(state: AppState, responses: Response[]): SupportSnapshot[] { return [...new Set(responses.map(r => r.submissionId))].map(submissionId => { const s = find(state.submissions,submissionId); return { submissionId, submissionRevision: s.revision, support: clone(s.support) }; }); }
function observationStatus(state: AppState, draft: CandidateFindingDraft, responses: Response[]): Finding['observationStatus'] {
  if (['ambiguous_transcription','insufficient_evidence'].includes(draft.code)) return 'insufficient';
  if (draft.code === 'denominator_addition') return 'not_demonstrated';
  if (!responses.some(r => r.mathCheck.status === 'correct' && r.mathCheck.equivalentReasoning)) return responses.some(r => r.mathCheck.status === 'incorrect') ? 'not_demonstrated' : 'insufficient';
  const levels = snapshots(state,responses).map(s => s.support.level);
  return levels.includes('unknown') ? 'unknown_support' : levels.includes('supported') ? 'supported' : 'independent';
}
function isResolved(state: AppState, response: Response): boolean { return state.readingReviews.some(r => r.responseId === response.id && r.responseRevision === response.revision); }
export function getEffectiveResponse(state: AppState, response: Response): Response {
  // Current eligibility uses the current checker, while saved responses and all
  // historical snapshots keep their original checks and revision identities.
  const legibility = response.legibility === 'uncertain' && isResolved(state,response) ? 'clear' : response.legibility;
  return { ...response, mathCheck: checkMath(getQuestion(response.questionId), response.workingText, response.answerText, legibility) };
}
function supportFresh(state: AppState, finding: Finding) { return finding.supportSnapshots.every(s => state.submissions.some(current => current.id === s.submissionId && current.revision === s.submissionRevision)); }
export function findingWarnings(state: AppState, draft: CandidateFindingDraft, options: { acknowledgeClear?: boolean; definitive?: boolean; batchId?: string } = {}): string[] {
  const responses = resolveEvidence(state,draft), warnings: string[] = [], correct = responses.filter(r => r.mathCheck.status === 'correct' && r.mathCheck.equivalentReasoning), support = snapshots(state,responses);
  const unresolved = responses.filter(r => (r.legibility === 'uncertain' || r.mathCheck.contradictions.length > 0) && !isResolved(state,r));
  const qualityOnly = draft.claimScope === 'evidence_quality';
  const explicitBatchId = options.batchId ?? ('batchId' in draft && typeof draft.batchId === 'string' ? draft.batchId : undefined);
  const batch = explicitBatchId ? find(state.batches,explicitBatchId) : undefined;
  const policy = batch ? getAssignment(batch.templateId)?.eligibilityPolicy : undefined;
  if (batch) evidenceForBatch(state,draft,batch.id);
  const currentCorrect = batch ? correct.filter(r => find(state.submissions,r.submissionId).batchId === batch.id) : correct;
  if (['ambiguous_transcription','insufficient_evidence'].includes(draft.code) && !qualityOnly) warnings.push('An evidence limitation must retain evidence-quality scope.');
  if (qualityOnly && ['extension','targeted_equal_parts','independent_application'].includes(draft.suggestedNextStep)) warnings.push('An evidence-quality limitation can request a check or more work, not an affirmative skill placement.');
  if (!qualityOnly && !responses.some(r => r.legibility === 'clear' && ['correct','incorrect'].includes(r.mathCheck.status))) warnings.push('A mathematical claim needs a completed clear response; blanks and unresolved work cannot establish a skill.');
  if (draft.claimScope === 'independent_performance' && !correct.length) warnings.push('Independent success needs correct equivalent-fraction reasoning in the cited work.');
  if (draft.code === 'needs_independent_check' && !correct.length) warnings.push('An independent-check interpretation needs demonstrated correct working; otherwise request more evidence.');
  if (batch && draft.suggestedNextStep === 'independent_application' && currentCorrect.length < Math.min(2,getTemplate(batch.templateId).questionIds.length)) warnings.push('Returning to planned application needs two fresh correct responses.');
  if (!qualityOnly && unresolved.length) warnings.push('Resolve uncertain or contradictory readings before confirming this claim.');
  if (!qualityOnly && !options.acknowledgeClear && responses.some(r => r.legibility !== 'blank' && !isResolved(state,r))) warnings.push('Acknowledge these source readings before confirmation.');
  if (draft.claimScope === 'independent_performance' && support.some(s => s.support.level !== 'independent')) warnings.push('Independent performance needs teacher-recorded independent conditions.');
  if (draft.code === 'denominator_addition' && responses.filter(r => r.legibility === 'clear' && r.mathCheck.denominatorAddition).length < 2) warnings.push('A repeated pattern needs two clear worked denominator-addition responses.');
  if (draft.code === 'equivalent_fraction_reasoning' && correct.length === 0) warnings.push('This claim needs correct equivalent-fraction working.');
  if (draft.code === 'correct_with_support' && (!correct.length || !support.some(s => s.support.level === 'supported'))) warnings.push('Supported success needs correct working and recorded assistance.');
  if (draft.suggestedNextStep === 'extension') {
    const allBatchResponses = state.responses.filter(r => { const s = find(state.submissions,r.submissionId); return s.studentId === draft.studentId && responses.some(selected => find(state.submissions,selected.submissionId).batchId === s.batchId); });
    if (correct.length < (policy?.extensionMinimum ?? 3) || support.some(s => s.support.level !== 'independent') || allBatchResponses.some(r => (r.legibility === 'uncertain' || r.mathCheck.contradictions.length > 0) && !isResolved(state,r))) warnings.push('Extension needs enough correct reasoned independent responses and no unresolved contradiction.');
    if (batch && currentCorrect.length < (policy?.extensionMinimum ?? 3)) warnings.push(`Extension needs ${policy?.extensionMinimum ?? 3} fresh correct responses in this assignment.`);
    if (batch && policy?.requiresPriorExtension) {
      const prior = getCurrentSkillFindings(state,{studentId:draft.studentId,beforeDate:batch.activityDate}).filter(f=>f.suggestedNextStep==='extension');
      const confirmedPriorIds = new Set(prior.flatMap(f => f.evidence.map(ref => ref.responseId)));
      if (currentCorrect.length < 2 || correct.filter(r => confirmedPriorIds.has(r.id)).length < 3) warnings.push('Continuing extension needs both fresh independent follow-up responses plus confirmed earlier extension evidence.');
    }
  }
  if (draft.suggestedNextStep === 'targeted_equal_parts' && draft.code !== 'denominator_addition' && draft.code !== 'other_teacher_finding') warnings.push('Targeted equal-parts support needs a reviewed instructional finding.');
  return [...new Set(warnings)];
}
function newFinding(state: AppState, draft: CandidateFindingDraft, batchId: string, provenance: Provenance | null, source: 'ai' | 'teacher', ctx: DomainContext): Finding {
  const responses = evidenceForBatch(state,draft,batchId);
  return { ...mutable(state,'finding',ctx), ...clone(draft), batchId, status: 'candidate', observationStatus: observationStatus(state,draft,responses), supportSnapshots: snapshots(state,responses), source, provenance, originalDraft: clone(draft), priorVersions: [], eligibilityWarnings: findingWarnings(state,draft,{batchId}) };
}
const refs = (responses: Response[]): EvidenceRef[] => responses.map(r => ({ responseId: r.id, responseRevision: r.revision }));
function deriveDraft(state: AppState, batch: Batch, studentId: string, responses: Response[]): CandidateFindingDraft {
  const policy = getAssignment(batch.templateId)!.eligibilityPolicy;
  const common = { studentId, objectiveId: 'obj-add-unlike-fractions', evidence: refs(responses), limitations: [] as string[] };
  const uncertain = responses.filter(r => (r.legibility === 'uncertain' || r.mathCheck.contradictions.length) && !isResolved(state,r));
  if (uncertain.length) return { ...common, code: 'ambiguous_transcription', claimScope: 'evidence_quality', explanation: 'A reading or written equality needs a closer look before deciding what this work demonstrates.', limitations: ['Inspect the original page and resolve the flagged reading.'], suggestedNextStep: 'gather_evidence' };
  const repeated = responses.filter(r => r.legibility === 'clear' && r.mathCheck.denominatorAddition);
  if (repeated.length >= 2) return { ...common, code: 'denominator_addition', claimScope: 'mathematics', explanation: `The working adds numerators and denominators in ${repeated.length} responses. Revisit equal-sized fractional parts before adding.`, suggestedNextStep: 'targeted_equal_parts' };
  const correct = responses.filter(r => r.mathCheck.status === 'correct' && r.mathCheck.equivalentReasoning);
  const support = snapshots(state,responses).map(s => s.support.level);
  if (correct.length && support.includes('supported')) return { ...common, code: 'correct_with_support', claimScope: 'mathematics', explanation: 'Correct equivalent-fraction working was demonstrated with recorded help. Keep that success and collect a brief independent check.', suggestedNextStep: 'independent_check' };
  if (correct.length && support.includes('unknown')) return { ...common, code: 'needs_independent_check', claimScope: 'mathematics', explanation: 'The submitted working includes correct fraction reasoning, but the assistance conditions are not recorded.', limitations: ['Independence is not established.'], suggestedNextStep: 'independent_check' };
  if (correct.length >= policy.extensionMinimum) {
    const prior = policy.requiresPriorExtension ? getCurrentSkillFindings(state,{studentId,beforeDate:batch.activityDate}).filter(f=>f.suggestedNextStep==='extension') : [];
    const priorResponses = [...new Map(prior.flatMap(f => resolveEvidence(state,f)).filter(r => !responses.some(current => current.id === r.id)).map(r => [r.id,r])).values()];
    const extension = !policy.requiresPriorExtension || priorResponses.length >= 3;
    return { ...common, evidence: refs([...responses,...priorResponses.slice(0,8-responses.length)]), code: 'equivalent_fraction_reasoning', claimScope: 'independent_performance', explanation: batch.kind === 'followup' ? 'The fresh independent check shows correct equivalent fractions and addition. Preserve earlier observations and use this new evidence for the next lesson.' : 'The work shows correct equivalent fractions and addition across this task, under recorded independent conditions.', suggestedNextStep: extension ? 'extension' : 'independent_application' };
  }
  const hasMissingAnswer=responses.some(response=>!response.answerText?.trim());
  return { ...common, code: 'insufficient_evidence', claimScope: 'evidence_quality', explanation: correct.length ? `${correct.length} completed response${correct.length===1?' shows':'s show'} correct independent working; ${hasMissingAnswer?'additional completed work':'review of the other responses'} is needed before making the next placement decision.` : 'This work does not establish the target skill or a repeated error pattern. Review the individual answers before deciding the next step.', limitations: [hasMissingAnswer?'Missing work is a request for evidence, not evidence of a misconception.':'Mixed results do not establish a repeated misconception or an extension placement.'], suggestedNextStep: 'gather_evidence' };
}
export function analyzeBatch(state: AppState, input: { batchId: string; provenance: Provenance; drafts?: CandidateFindingDraft[] }, ctx: DomainContext = {}) {
  const batch = find(state.batches,input.batchId), template = getTemplate(batch.templateId);
  for (const submissionId of batch.submissionIds) invariant(state.responses.filter(r => r.submissionId === submissionId).length === template.questionIds.length,'INCOMPLETE_EXTRACTION','Every selected worksheet must be extracted before analysis.');
  const drafts = input.drafts ? analysisSchema.parse({findings: input.drafts}).findings : batch.submissionIds.flatMap(submissionId => {
    const submission = find(state.submissions,submissionId), responses=state.responses.filter(r => r.submissionId === submissionId).map(r=>getEffectiveResponse(state,r)), primary=deriveDraft(state,batch,submission.studentId,responses);
    const correct=responses.filter(r=>r.mathCheck.status==='correct' && r.mathCheck.equivalentReasoning && r.legibility==='clear');
    if(primary.code==='insufficient_evidence' && correct.length>0 && submission.support.level==='independent') return [primary,{studentId:submission.studentId,objectiveId:'obj-add-unlike-fractions',evidence:refs(correct),code:'equivalent_fraction_reasoning' as const,claimScope:'independent_performance' as const,explanation:`${correct.length} completed response${correct.length===1?' demonstrates':'s demonstrate'} correct independent fraction reasoning. Keep this observation while reviewing the rest of the work.`,limitations:[`This observation covers only ${correct.length===1?'the cited correct response':'the '+correct.length+' cited correct responses'}.`],suggestedNextStep:'gather_evidence' as const}];
    return [primary];
  });
  for (const draft of drafts) { const warnings = findingWarnings(state,draft,{acknowledgeClear:true,batchId:batch.id}); invariant(!warnings.some(w => !w.includes('Resolve uncertain')), 'INVALID_FINDING', warnings.join(' ')); }
  const created: Finding[] = [];
  for (const old of state.findings.filter(f => f.batchId === batch.id && f.status === 'candidate' && drafts.some(d=>d.studentId===f.studentId))) { old.status = 'stale'; touch(old,ctx); }
  for (const draft of drafts) {
    if (state.findings.some(f => f.batchId === batch.id && f.status === 'confirmed' && f.studentId === draft.studentId && f.code === draft.code && JSON.stringify(f.evidence) === JSON.stringify(draft.evidence) && supportFresh(state,f))) continue;
    const finding = newFinding(state,draft,batch.id,input.provenance,'ai',ctx); state.findings.push(finding); created.push(finding);
  }
  audit(state,'batch.analyzed',batch.id,{count:created.length,mode:input.provenance.mode},ctx); return created;
}
export function createFinding(state: AppState, raw: CandidateFindingDraft & { batchId: string }, ctx: DomainContext = {}) {
  const { batchId, ...rest } = raw, draft = candidateFindingSchema.parse(rest), finding = newFinding(state,draft,batchId,null,'teacher',ctx); state.findings.push(finding); invalidateProposals(state,ctx); audit(state,'finding.created',finding.id,{},ctx); return finding;
}
export function editFinding(state: AppState, findingId: string, raw: z.input<typeof editFindingSchema>, ctx: DomainContext = {}) {
  const input = editFindingSchema.parse(raw), finding = find(state.findings,findingId); expected(finding,input.expectedRevision);
  const { reason } = input; const changes = { objectiveId: input.objectiveId, code: input.code, claimScope: input.claimScope, explanation: input.explanation, evidence: input.evidence, limitations: input.limitations, suggestedNextStep: input.suggestedNextStep }; const draft = candidateFindingSchema.parse({...changes,studentId:finding.studentId}); const responses = evidenceForBatch(state,draft,finding.batchId);
  finding.priorVersions.push(candidateFindingSchema.parse({ studentId: finding.studentId, objectiveId: finding.objectiveId, code: finding.code, claimScope: finding.claimScope, explanation: finding.explanation, evidence: finding.evidence, limitations: finding.limitations, suggestedNextStep: finding.suggestedNextStep }));
  withdrawObservations(state,finding.id,reason); Object.assign(finding,draft,{status:'candidate',source:'teacher',supportSnapshots:snapshots(state,responses),observationStatus:observationStatus(state,draft,responses),eligibilityWarnings:findingWarnings(state,draft,{batchId:finding.batchId})}); touch(finding,ctx); invalidateProposals(state,ctx); audit(state,'finding.edited',finding.id,{reason},ctx); return finding;
}
export function reviewFindings(state: AppState, raw: z.input<typeof reviewFindingsSchema>, ctx: DomainContext = {}) {
  const input = reviewFindingsSchema.parse(raw); invariant(new Set(input.items.map(i=>i.findingId)).size === input.items.length,'DUPLICATE_REVIEW','Review each finding once.');
  const selected = input.items.map(item => ({ item, finding: find(state.findings,item.findingId) }));
  for (const {item,finding} of selected) {
    expected(finding,item.expectedRevision); invariant(finding.status !== 'stale','STALE_FINDING','Refresh findings after the evidence changes.',409);
    if (item.decision === 'confirm') { invariant(supportFresh(state,finding),'SUPPORT_CHANGED','Support context changed. Refresh this finding.',409); const warnings = findingWarnings(state,finding,{acknowledgeClear:input.acknowledgeClearReadings}); invariant(!warnings.length,'REVIEW_REQUIRED',warnings.join(' ')); }
  }
  let changed = false;
  for (const {item,finding} of selected) {
    if (finding.status === (item.decision === 'confirm' ? 'confirmed' : 'rejected')) continue;
    changed = true;
    if (item.decision === 'confirm') {
      if (input.acknowledgeClearReadings) for (const response of resolveEvidence(state,finding)) if (response.legibility === 'clear' && !response.mathCheck.contradictions.length && !isResolved(state,response)) { state.readingReviews.push({...base(state,'reading',ctx),responseId:response.id,responseRevision:response.revision,actorId:ctx.actorId||state.ownerId,note:'Teacher acknowledged source reading during finding review.'}); response.readingStatus = 'resolved'; }
      finding.status = 'confirmed'; touch(finding,ctx); finding.reviewedAt = now(ctx); finding.reviewedBy = ctx.actorId || state.ownerId; finding.eligibilityWarnings = [];
      const event = audit(state,'finding.confirmed',finding.id,{revision:finding.revision},ctx), batch = find(state.batches,finding.batchId);
      state.observations.push({...base(state,'observation',ctx),findingId:finding.id,findingRevision:finding.revision,studentId:finding.studentId,objectiveId:finding.objectiveId,date:batch.activityDate,templateId:batch.templateId,difficulty:getTemplate(batch.templateId).questionIds.map(q=>getQuestion(q).taskDifficulty).filter((v,i,a)=>a.indexOf(v)===i).join(', '),evidence:clone(finding.evidence),supportSnapshots:clone(finding.supportSnapshots),interpretation:finding.explanation,observationStatus:finding.observationStatus,suggestedNextStep:finding.suggestedNextStep,reviewEventId:event.id,superseded:false});
    } else { finding.status='rejected'; touch(finding,ctx); withdrawObservations(state,finding.id,input.reason || 'Teacher rejected this interpretation.'); audit(state,'finding.rejected',finding.id,{reason:input.reason||''},ctx); }
  }
  if (changed) invalidateProposals(state,ctx); return selected.map(s=>s.finding);
}
export function getPlanningFindings(state: AppState, lessonDate: string): Finding[] {
  return getCurrentSkillFindings(state,{beforeDate:lessonDate}).filter(f=>!findingWarnings(state,f,{acknowledgeClear:true}).length);
}
export function validateLesson(state: AppState, raw: LessonSnapshot): LessonSnapshot {
  const lesson = lessonSchema.parse(raw);
  invariant(lesson.unitId === curriculum.unit.id && curriculum.unit.availableTeachingDates.includes(lesson.date),'LESSON_DATE','Keep lessons inside the authored teaching days.');
  invariant(lesson.date !== curriculum.unit.fixedAssessmentDate,'LOCKED_ASSESSMENT','The fixed assessment date cannot be replaced.');
  invariant(curriculum.unit.learningObjectiveIds.every(objectiveId=>lesson.objectiveIds.includes(objectiveId)) && lesson.objectiveIds.every(objectiveId=>curriculum.objectives.some(o=>o.id===objectiveId)),'REQUIRED_OBJECTIVES','Preserve all required unit objectives.');
  const blockIds = ['warmup','model','practice','application','exit'];
  invariant(lesson.blocks.every((b,i)=>b.id===blockIds[i]),'BLOCK_ORDER','Preserve the five lesson blocks and their prerequisite order.');
  invariant(lesson.blocks.reduce((total,b)=>total+b.minutes,0)===45 && lesson.blocks.every((b,i)=>b.minutes===[5,8,12,15,5][i]),'LESSON_TIME','The lesson must keep its 5 + 8 + 12 + 15 + 5 minute blocks.');
  const roster=state.students.filter(s=>s.active).map(s=>s.id);
  for (const block of lesson.blocks) {
    if (block.mode==='concurrent') {
      invariant(block.id==='practice' && block.lanes?.length===3,'PRACTICE_LANES','Only practice can use three concurrent lanes.');
      const lanes=block.lanes!;
      invariant(new Set(lanes.map(l=>l.id)).size===3 && ['targeted','independent','extension'].every(laneId=>lanes.some(l=>l.id===laneId)),'LANE_IDS','Keep targeted, independent and extension lanes.');
      invariant(lanes.every(l=>l.minutes===12) && lanes.filter(l=>l.teacherLed).length<=1,'CONCURRENT_TIME','Every lane occupies the same 12 minutes; only one teacher-led lane is available.');
      const assigned=lanes.flatMap(l=>l.studentIds);
      invariant(assigned.length===roster.length && new Set(assigned).size===roster.length && roster.every(s=>assigned.includes(s)),'ROSTER_COVERAGE','Every active student must occur in exactly one lane.');
      invariant(lanes.every(l=>l.entryCheckStudentIds.every(s=>l.studentIds.includes(s))),'ENTRY_CHECK_MEMBERSHIP','Entry checks must belong to students in that lane.');
      invariant(lanes.every(l=>l.materialIds.every(materialId=>curriculum.materials.some(m=>m.id===materialId))),'MATERIAL_REFERENCE','Use an authored, validated activity.');
    } else invariant(!block.lanes?.length,'LANE_MODE','Whole-class blocks cannot contain concurrent lanes.');
    invariant((block.materialIds||[]).every(materialId=>curriculum.materials.some(m=>m.id===materialId)),'MATERIAL_REFERENCE','Use an authored, validated activity.');
  }
  return lesson;
}
function validateMaterials(materials: Material[]) {
  for (const material of materials) for (const prompt of material.prompts) {
    if (prompt.validationKind==='fraction-addition') invariant(prompt.operands.length===2 && !!prompt.expectedRational && equalFractions(addFractions(prompt.operands[0],prompt.operands[1]),prompt.expectedRational),'MATERIAL_MATH',`The answer key for ${prompt.id} does not match its operands.`);
    if (prompt.examplePairs && prompt.expectedRational) invariant(prompt.examplePairs.every(pair=>pair.length===2 && equalFractions(addFractions(pair[0],pair[1]),prompt.expectedRational!)),'MATERIAL_MATH',`A constructed example for ${prompt.id} is invalid.`);
  }
}
export function proposalAfter(state: AppState, proposal: Proposal, selectedChangeIds = proposal.changes.map(c=>c.id)): LessonSnapshot {
  const snapshot = clone(find(state.planVersions,proposal.basePlanVersionId).snapshot);
  for (const change of proposal.changes) if (selectedChangeIds.includes(change.id) && change.operation!=='schedule_checkpoint') snapshot.blocks=snapshot.blocks.map(block=>block.id===change.payload.block.id?clone(change.payload.block):block);
  return snapshot;
}
export function proposalIsFresh(state: AppState, proposal: Proposal): boolean { return proposal.status==='draft' && proposal.evidenceRevision===state.classroom.evidenceRevision && proposal.calendarRevision===state.classroom.calendarRevision && find(state.plans,proposal.lessonId).currentVersionId===proposal.basePlanVersionId; }
export type EligibleCheckpoint = { calendarEntryId: string; templateId: string; title: string; minutes: number; offsetMinutes: number; materialIds: string[] };
export function getEligibleCheckpoints(state: AppState, lessonId: string): EligibleCheckpoint[] {
  const lesson = state.plans.find(plan=>plan.id===lessonId);
  if (!lesson) return [];
  return curriculum.calendar.flatMap(authored=>{
    const allocation = authored.proposedAllocation;
    if (!allocation) return [];
    const assignment = getAssignment(allocation.checkpointTemplateId), entry = state.calendarEntries.find(e=>e.id===authored.id);
    if (!assignment || assignment.sourceLessonId!==lessonId || !entry || entry.locked || entry.preview || entry.checkpoint || entry.date<=lesson.date || entry.date!==assignment.date || allocation.checkpointMinutes+allocation.checkpointOffsetMinutes>entry.minutes) return [];
    const title = getTemplate(assignment.templateId).title.replace(/^A\s+/, '');
    return [{calendarEntryId:entry.id,templateId:assignment.templateId,title:title.charAt(0).toUpperCase()+title.slice(1),minutes:allocation.checkpointMinutes,offsetMinutes:allocation.checkpointOffsetMinutes,materialIds:curriculum.materials.filter(material=>material.id===assignment.templateId).map(material=>material.id)}];
  });
}
function validateChanges(state: AppState, proposal: Proposal, selectedIds = proposal.changes.map(c=>c.id)) {
  invariant(selectedIds.length===new Set(selectedIds).size && selectedIds.every(changeId=>proposal.changes.some(c=>c.id===changeId)),'CHANGE_SELECTION','Select known changes once each.');
  invariant(new Set(proposal.changes.map(c=>c.id)).size===proposal.changes.length,'DUPLICATE_CHANGE','Each proposal change must have a distinct identity.');
  invariant(new Set(proposal.changes.map(c=>c.operation)).size===proposal.changes.length,'DUPLICATE_OPERATION','Use at most one change of each kind.');
  const selected=proposal.changes.filter(c=>selectedIds.includes(c.id)), snapshot=proposalAfter(state,proposal,selectedIds), current=getPlanningFindings(state,snapshot.date);
  for (const change of selected) {
    invariant(change.dependsOnChangeIds.every(changeId=>selectedIds.includes(changeId)),'CHANGE_DEPENDENCY','Select the changes required by this activity.');
    invariant(change.findingIds.length>0 && new Set(change.findingIds).size===change.findingIds.length,'CONFIRMED_EVIDENCE_REQUIRED','Instructional changes need confirmed evidence.');
    const findings=change.findingIds.map(findingId=>find(state.findings,findingId));
    invariant(findings.every(f=>current.some(c=>c.id===f.id)),'STALE_EVIDENCE','Only current confirmed findings may support this change.',409);
    invariant(change.evidence.length>0 && new Set(change.evidence.map(ref=>ref.responseId)).size===change.evidence.length && findings.every(f=>change.evidence.some(ref=>f.evidence.some(e=>e.responseId===ref.responseId&&e.responseRevision===ref.responseRevision))) && change.evidence.every(ref=>findings.some(f=>f.evidence.some(e=>e.responseId===ref.responseId && e.responseRevision===ref.responseRevision))),'CHANGE_EVIDENCE','Keep source evidence for every cited confirmed finding; each reference must be current and occur once.');
    invariant(change.affectedStudentIds.length>0 && new Set(change.affectedStudentIds).size===change.affectedStudentIds.length && change.affectedStudentIds.every(studentId=>state.students.some(s=>s.id===studentId&&s.active)),'CHANGE_STUDENT','This change contains an unknown student.');
    if (change.operation==='replace_practice') {
      invariant(change.payload.block.id==='practice' && change.payload.block.mode==='concurrent' && change.payload.block.lanes?.length===3,'CHANGE_BLOCK','Practice replacement must preserve the three concurrent pathways.');
      const roster=state.students.filter(s=>s.active).map(s=>s.id);
      invariant(roster.length===change.affectedStudentIds.length&&roster.every(id=>change.affectedStudentIds.includes(id)),'CHANGE_ROSTER','The practice replacement affects every active student exactly once.');
      for (const lane of change.payload.block.lanes||[]) for (const studentId of lane.studentIds) {
        if (lane.id==='extension') invariant(findings.some(f=>f.studentId===studentId && f.suggestedNextStep==='extension' && !findingWarnings(state,f,{acknowledgeClear:true}).length),'EXTENSION_EVIDENCE','Extension membership needs current confirmed independent evidence.');
        if (lane.id==='targeted') invariant(findings.some(f=>f.studentId===studentId && f.suggestedNextStep==='targeted_equal_parts'),'TARGETED_EVIDENCE','Targeted membership needs a current confirmed finding.');
      }
    }
    if (change.operation==='replace_exit') invariant(change.payload.block.id==='exit' && change.payload.block.minutes===5,'CHANGE_BLOCK','Exit changes must preserve the five-minute exit block.');
    if (change.operation==='schedule_checkpoint') {
      const entry=find(state.calendarEntries,change.payload.calendarEntryId), template=getTemplate(change.payload.templateId);
      const allowed=getEligibleCheckpoints(state,proposal.lessonId).find(checkpoint=>checkpoint.calendarEntryId===entry.id&&checkpoint.templateId===template.id);
      invariant(allowed && change.payload.minutes===allowed.minutes && change.payload.offsetMinutes===allowed.offsetMinutes,'CHECKPOINT_ALLOWED','Use an authored checkpoint for this lesson within its reserved allocation.');
      invariant(!entry.locked && !entry.preview && entry.date>snapshot.date && entry.date===template.date,'CHECKPOINT_DATE','Put this fresh check on its planned future teaching date; locked dates stay fixed.');
      invariant(change.payload.offsetMinutes+change.payload.minutes<=entry.minutes && change.payload.minutes===8,'CALENDAR_TIME','The check must fit eight minutes inside the existing lesson.');
      invariant(!entry.checkpoint || entry.checkpoint.proposalId===proposal.id,'CHECKPOINT_OVERLAP','This day already contains an accepted checkpoint.');
      invariant(change.payload.materialIds.every(materialId=>curriculum.materials.some(m=>m.id===materialId)),'MATERIAL_REFERENCE','The checkpoint references an unknown printable.');
      for (const dependencyId of entry.prerequisiteEntryIds) invariant(find(state.calendarEntries,dependencyId).date<=entry.date,'CALENDAR_PREREQUISITE','Keep prerequisite lessons before this calendar entry.');
    }
  }
  validateLesson(state,snapshot); return snapshot;
}
export function generateProposal(state: AppState, lessonId: string, raw: z.input<typeof generateProposalSchema> & { provenance: Provenance; changes?: ProposalChange[] }, ctx: DomainContext = {}): Proposal {
  const {provenance,changes,...request}=raw, input=generateProposalSchema.parse(request), plan=find(state.plans,lessonId), version=find(state.planVersions,plan.currentVersionId);
  invariant(input.basePlanVersionId===plan.currentVersionId && input.expectedEvidenceRevision===state.classroom.evidenceRevision && input.expectedCalendarRevision===state.classroom.calendarRevision,'STALE_INPUT','Evidence or the current lesson changed. Refresh before generating.',409);
  invariant(!state.findings.some(f=>f.status==='confirmed' && find(state.batches,f.batchId).activityDate>=plan.date),'TARGET_LESSON','Use the future lesson after the newest reviewed work. Do not rewrite a taught lesson.');
  const findings=getPlanningFindings(state,plan.date); invariant(findings.length>0,'CONFIRMED_EVIDENCE_REQUIRED','Confirm findings before proposing instruction.');
  const latestAssignment=findings.map(f=>getAssignment(find(state.batches,f.batchId).templateId)!).sort((a,b)=>b.date.localeCompare(a.date)||b.sequence-a.sequence)[0];
  invariant(latestAssignment.targetLessonId===lessonId,'TARGET_LESSON','Choose the lesson after the latest reviewed assignment. Do not rewrite a taught lesson.');
  const roster=state.students.filter(s=>s.active).map(s=>s.id), targeted=roster.filter(studentId=>findings.some(f=>f.studentId===studentId&&f.suggestedNextStep==='targeted_equal_parts'));
  const extension=roster.filter(studentId=>!targeted.includes(studentId)&&findings.some(f=>f.studentId===studentId&&f.suggestedNextStep==='extension'));
  const independent=roster.filter(studentId=>!targeted.includes(studentId)&&!extension.includes(studentId)), checks=independent.filter(studentId=>!findings.some(f=>f.studentId===studentId&&f.suggestedNextStep==='independent_application'));
  const common={findingIds:findings.map(f=>f.id),evidence:[...new Map(findings.flatMap(f=>f.evidence).map(ref=>[ref.responseId,ref])).values()],affectedStudentIds:roster,dependsOnChangeIds:[] as string[]};
  const defaultChanges: ProposalChange[]=[
    {...common,id:id('change',ctx),operation:'replace_practice',rationale:'Use the reviewed work to give targeted help, continued application and extension during the same 12 minutes. Unresolved evidence receives a short check.',payload:{block:{id:'practice',title:'Three pathways, one shared lesson',minutes:12,mode:'concurrent',instructions:'Run these activities concurrently. Keep the rest of the lesson on schedule; record any help given.',lanes:[
      {id:'targeted',title:'Equal parts, together',studentIds:targeted,teacherLed:true,minutes:12,instructions:'Use equal-length fraction strips. Rename each addend in the same-sized parts, then add. Ask why adding denominators changes the unit.',materialIds:['targeted-equal-parts-v1'],entryCheckStudentIds:[]},
      {id:'independent',title:'Check and apply',studentIds:independent,teacherLed:false,minutes:12,instructions:'Students needing more evidence begin with an independent entry check. Then solve the application tasks. Keep incomplete work as an open question.',materialIds:['entry-check-v1','application-practice-v1'],entryCheckStudentIds:checks},
      {id:'extension',title:'Two methods, one value',studentIds:extension,teacherLed:false,minutes:12,instructions:'Solve with two valid common denominators and explain why the results name the same quantity.',materialIds:['extension-explain-v1'],entryCheckStudentIds:[]},
    ]}}},
    {...common,id:id('change',ctx),operation:'replace_exit',rationale:'Collect a short explanation of equal-sized parts to decide whether the instruction transferred.',payload:{block:{id:'exit',title:'Explain the common unit',minutes:5,instructions:'Solve 1/4 + 1/6 and finish: Before adding, I rewrite the fractions because… Record actual assistance.',mode:'whole_class',materialIds:['exit-equal-units-v1']}}},
  ];
  for (const checkpoint of getEligibleCheckpoints(state,lessonId).slice(0,1)) defaultChanges.push({...common,id:id('change',ctx),operation:'schedule_checkpoint',rationale:'Collect fresh work in the authored checkpoint. Keep the fixed assessment and later units in place.',payload:checkpoint});
  const validatedChanges=z.array(proposalChangeSchema).min(1).max(3).parse(changes||defaultChanges);
  const proposal: Proposal={...mutable(state,'proposal',ctx),lessonId,basePlanVersionId:version.id,evidenceRevision:state.classroom.evidenceRevision,calendarRevision:state.classroom.calendarRevision,inputFingerprint:inputFingerprint(state),status:'draft',changes:clone(validatedChanges),originalChanges:clone(validatedChanges),provenance:clone(provenance),teacherEdited:false,selectedChangeIds:[]};
  validateChanges(state,proposal); state.proposals.push(proposal); audit(state,'proposal.created',proposal.id,{lessonId,mode:provenance.mode},ctx); return proposal;
}
export function editProposal(state: AppState, proposalId: string, raw: z.input<typeof editProposalSchema>, ctx: DomainContext = {}) {
  const input=editProposalSchema.parse(raw),proposal=find(state.proposals,proposalId); expected(proposal,input.expectedRevision); invariant(proposalIsFresh(state,proposal),'STALE_PROPOSAL','Refresh this proposal before editing.',409);
  invariant(input.changes.length===proposal.changes.length && input.changes.every(c=>proposal.changes.some(original=>original.id===c.id&&original.operation===c.operation)),'CHANGE_IDENTITIES','Edit existing changes without replacing their identities.');
  const candidate={...clone(proposal),changes:clone(input.changes)}; validateChanges(state,candidate); proposal.changes=candidate.changes; proposal.teacherEdited=true; touch(proposal,ctx); audit(state,'proposal.edited',proposal.id,{reason:input.reason},ctx); return proposal;
}
export type ApplyResult={proposalId:string;planVersionId:string;materialSetId?:string;keptOriginal:boolean};
export function applyProposal(state: AppState, proposalId: string, raw: z.input<typeof applyProposalSchema>, ctx: DomainContext = {}): ApplyResult {
  const input=applyProposalSchema.parse(raw),operation=`proposal.apply:${proposalId}`,requestHash=JSON.stringify(input);
  if (ctx.idempotencyKey) { const existing=state.mutationKeys.find(k=>k.operation===operation&&k.key===ctx.idempotencyKey); if(existing) { invariant(existing.requestHash===requestHash,'IDEMPOTENCY_CONFLICT','That request key was already used for a different selection.',409); return clone(existing.result as ApplyResult); } }
  const proposal=find(state.proposals,proposalId); expected(proposal,input.expectedRevision);
  invariant(proposalIsFresh(state,proposal)&&input.basePlanVersionId===proposal.basePlanVersionId&&input.expectedEvidenceRevision===proposal.evidenceRevision&&input.expectedCalendarRevision===proposal.calendarRevision,'STALE_PROPOSAL','Evidence, calendar or lesson changed. Generate a fresh proposal.',409);
  const snapshot=validateChanges(state,proposal,input.selectedChangeIds),plan=find(state.plans,proposal.lessonId),previous=find(state.planVersions,plan.currentVersionId);
  let result:ApplyResult;
  if(!input.selectedChangeIds.length) { proposal.status='discarded';touch(proposal,ctx);result={proposalId,planVersionId:previous.id,keptOriginal:true};audit(state,'proposal.discarded',proposalId,{},ctx); }
  else {
    const selected=proposal.changes.filter(c=>input.selectedChangeIds.includes(c.id)),materialIds=new Set(snapshot.blocks.flatMap(b=>[...(b.materialIds||[]),...(b.lanes||[]).flatMap(l=>l.materialIds)]));
    for (const entry of state.calendarEntries) if (entry.checkpoint) {
      const accepted=state.proposals.find(p=>p.id===entry.checkpoint!.proposalId&&p.lessonId===plan.id&&p.status==='applied');
      for (const change of accepted?.changes||[]) if (change.operation==='schedule_checkpoint'&&accepted?.selectedChangeIds.includes(change.id)&&change.payload.calendarEntryId===entry.id) for (const materialId of change.payload.materialIds) materialIds.add(materialId);
    }
    for(const change of selected) if(change.operation==='schedule_checkpoint') for(const materialId of change.payload.materialIds) materialIds.add(materialId);
    const materials=curriculum.materials.filter(m=>materialIds.has(m.id)); validateMaterials(materials);
    const version:PlanVersion={...base(state,'plan-version',ctx),lessonId:plan.id,versionNumber:previous.versionNumber+1,previousVersionId:previous.id,snapshot:clone(snapshot),proposalId,selectedChangeIds:clone(input.selectedChangeIds),evidence:[...new Map(selected.flatMap(c=>c.evidence).map(ref=>[ref.responseId,ref])).values()],actorId:ctx.actorId||state.ownerId};
    const materialSet={...base(state,'materials',ctx),planVersionId:version.id,materials:clone(materials),studentIds:state.students.filter(s=>s.active).map(s=>s.id)};
    state.planVersions.push(version);state.materialSets.push(materialSet);plan.currentVersionId=version.id;touch(plan,ctx);
    for(const entry of state.calendarEntries) if(entry.lessonId===plan.id){entry.planVersionId=version.id;touch(entry,ctx);}
    for(const change of selected) if(change.operation==='schedule_checkpoint'){const entry=find(state.calendarEntries,change.payload.calendarEntryId);entry.checkpoint={templateId:change.payload.templateId,offsetMinutes:change.payload.offsetMinutes,minutes:change.payload.minutes,title:change.payload.title,proposalId};touch(entry,ctx);}
    state.classroom.calendarRevision++;touch(state.classroom,ctx);proposal.status='applied';proposal.selectedChangeIds=clone(input.selectedChangeIds);proposal.appliedVersionId=version.id;touch(proposal,ctx);
    for(const other of state.proposals) if(other.id!==proposal.id&&other.status==='draft'){other.status='stale';touch(other,ctx);}
    audit(state,'proposal.applied',proposalId,{planVersionId:version.id,selectedChangeIds:input.selectedChangeIds},ctx);result={proposalId,planVersionId:version.id,materialSetId:materialSet.id,keptOriginal:false};
  }
  if(ctx.idempotencyKey) state.mutationKeys.push({...base(state,'mutation',ctx),operation,key:ctx.idempotencyKey,requestHash,result:clone(result)});return result;
}
export function confirmLessonImport(state:AppState,importId:string,raw:z.input<typeof confirmLessonImportSchema>,ctx:DomainContext={}){
  const input=confirmLessonImportSchema.parse(raw),record=find(state.lessonImports,importId);expected(record,input.expectedRevision);invariant(record.status==='draft','IMPORT_CONFIRMED','This import has already been confirmed.',409);
  const snapshot=validateLesson(state,input.lesson),existing=state.plans.find(p=>p.id===snapshot.lessonId),previous=existing?find(state.planVersions,existing.currentVersionId):null;
  invariant(!existing||input.expectedPlanVersionId===existing.currentVersionId,'LESSON_ID_CONFLICT','This lesson already exists. Review and supply its current version before replacing it.',409);
  if(existing)invariant(existing.date===snapshot.date&&existing.unitId===snapshot.unitId,'LESSON_IDENTITY','An import cannot move an existing lesson date or unit.');
  const version:PlanVersion={...base(state,'plan-version',ctx),lessonId:snapshot.lessonId,versionNumber:previous?previous.versionNumber+1:1,previousVersionId:previous?.id||null,snapshot:clone(snapshot),proposalId:null,selectedChangeIds:[],evidence:[],actorId:ctx.actorId||state.ownerId,sourceAssetId:record.assetId};
  state.planVersions.push(version);if(existing){existing.currentVersionId=version.id;existing.title=snapshot.title;touch(existing,ctx);}else state.plans.push({...mutable(state,'lesson',ctx),id:snapshot.lessonId,unitId:snapshot.unitId,date:snapshot.date,title:snapshot.title,currentVersionId:version.id});
  record.status='confirmed';record.draft=clone(snapshot);record.planVersionId=version.id;touch(record,ctx);
  for(const entry of state.calendarEntries)if(entry.lessonId===snapshot.lessonId){entry.planVersionId=version.id;touch(entry,ctx);}
  state.classroom.calendarRevision++;for(const proposal of state.proposals)if(proposal.status==='draft'){proposal.status='stale';touch(proposal,ctx);}audit(state,'lesson.imported',snapshot.lessonId,{planVersionId:version.id,assetId:record.assetId},ctx);return version;
}
