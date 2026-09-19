import { describe, expect, it } from 'vitest';
import { assignments, CATALOG_VERSION } from '../../lib/assignments';
import { curriculum } from '../../lib/curriculum';
import type { AppState } from '../../lib/contracts';
import { analyzeBatch, applyProposal, createInitialState, generateProposal, getEligibleCheckpoints, inputFingerprint, reviewFindings, upgradeCatalog } from '../../lib/domain';
import { legacyState, seedAssignment, testProvenance } from './helpers';
function confirm(state:AppState,batchId:string){return reviewFindings(state,{items:state.findings.filter(f=>f.batchId===batchId&&f.status==='candidate').map(f=>({findingId:f.id,expectedRevision:f.revision,decision:'confirm'})),acknowledgeClearReadings:true});}
function proposal(state:AppState,lessonId:string){return generateProposal(state,lessonId,{basePlanVersionId:state.plans.find(p=>p.id===lessonId)!.currentVersionId,expectedEvidenceRevision:state.classroom.evidenceRevision,expectedCalendarRevision:state.classroom.calendarRevision,provenance:testProvenance});}
function apply(state:AppState,p:ReturnType<typeof proposal>){return applyProposal(state,p.id,{expectedRevision:p.revision,basePlanVersionId:p.basePlanVersionId,expectedEvidenceRevision:p.evidenceRevision,expectedCalendarRevision:p.calendarRevision,selectedChangeIds:p.changes.map(c=>c.id)});}

describe('catalog expansion without rewriting teacher history',()=>{
  it('adds missing lessons exactly once and preserves accepted versions, evidence and allocations',()=>{
    const state=legacyState(),batch=seedAssignment(state,'baseline-template-v1',{studentIds:['stu-01']});analyzeBatch(state,{batchId:batch.id,provenance:testProvenance});confirm(state,batch.id);
    const accepted=apply(state,proposal(state,'lesson-2026-09-23'));
    const history=JSON.stringify({versions:state.planVersions,materials:state.materialSets,extractions:state.extractions,observations:state.observations});
    const allocation=JSON.stringify(state.calendarEntries.find(e=>e.date==='2026-09-24'));
    const assessment=JSON.stringify(state.calendarEntries.find(e=>e.locked));
    const oldVersionIds=new Set(state.planVersions.map(v=>v.id));
    expect(upgradeCatalog(state)).toBe(true);
    expect(state.plans).toHaveLength(curriculum.lessons.length);
    expect(state.plans.find(p=>p.id==='lesson-2026-09-23')!.currentVersionId).toBe(accepted.planVersionId);
    expect(JSON.stringify({versions:state.planVersions.filter(v=>oldVersionIds.has(v.id)),materials:state.materialSets,extractions:state.extractions,observations:state.observations})).toBe(history);
    expect(JSON.stringify(state.calendarEntries.find(e=>e.date==='2026-09-24'))).toBe(allocation);
    expect(JSON.stringify(state.calendarEntries.find(e=>e.locked))).toBe(assessment);
    expect(state.classroom.catalogVersion).toBe(CATALOG_VERSION);
    const after=JSON.stringify(state);expect(upgradeCatalog(state)).toBe(false);expect(JSON.stringify(state)).toBe(after);
    for(const id of ['lesson-2026-09-28','lesson-2026-09-29','lesson-2026-10-01'])expect(state.calendarEntries.some(e=>e.lessonId===id&&e.planVersionId===state.plans.find(p=>p.id===id)!.currentVersionId)).toBe(true);
  });
  it('invalidates pending interpretations and leases on a catalog change, retaining completed steps',()=>{
    const state=legacyState(),before=inputFingerprint(state);
    state.jobs.push({id:'legacy-job',ownerId:'teacher',createdAt:'2026-09-19',updatedAt:'2026-09-19',revision:1,type:'analysis',status:'running',inputFingerprint:before,steps:[{id:'done',kind:'extract',status:'completed',attempts:1,inputFingerprint:before},{id:'running',kind:'analyze',status:'running',attempts:1,inputFingerprint:before,leaseToken:'lease',leaseExpiresAt:'2099-01-01'}]});
    upgradeCatalog(state);expect(state.jobs[0].status).toBe('cancelled');expect(state.jobs[0].steps.map(s=>s.status)).toEqual(['completed','cancelled']);expect(state.jobs[0].steps[1].leaseToken).toBeUndefined();expect(inputFingerprint(state)).not.toBe(before);
  });
});

describe('five authored assignments and later teaching decisions',()=>{
  it('does not describe a completed incorrect answer as missing work',()=>{
    const state=createInitialState('teacher'),batch=seedAssignment(state,'fraction-practice-template-v1',{studentIds:['stu-02']});
    const findings=analyzeBatch(state,{batchId:batch.id,provenance:testProvenance});
    expect(state.responses.every(response=>response.answerText)).toBe(true);
    expect(findings).toHaveLength(2);
    expect(findings.map(f=>f.explanation+' '+f.limitations.join(' ')).join(' ')).not.toMatch(/missing|only the completed question/i);
    expect(findings.find(f=>f.claimScope==='independent_performance')!.explanation).toMatch(/2 completed responses/);
  });
  it('lets later independently correct work newly qualify for extension, with no inherited label',()=>{
    const state=createInitialState('teacher');
    const first=seedAssignment(state,'baseline-template-v1',{studentIds:['stu-01']});analyzeBatch(state,{batchId:first.id,provenance:testProvenance});confirm(state,first.id);
    const original=apply(state,proposal(state,'lesson-2026-09-23'));const snapshot=JSON.stringify(state.planVersions.find(v=>v.id===original.planVersionId));
    const later=seedAssignment(state,'fraction-practice-template-v1',{studentIds:['stu-01']});const [finding]=analyzeBatch(state,{batchId:later.id,provenance:testProvenance});
    expect(finding.suggestedNextStep).toBe('extension');expect(finding.status).toBe('candidate');
    expect(()=>proposal(state,'lesson-2026-09-28')).toThrow(/Confirm/);
    confirm(state,later.id);const next=proposal(state,'lesson-2026-09-28');
    const practice=next.changes.find(c=>c.operation==='replace_practice')!;
    expect(practice.operation==='replace_practice'&&practice.payload.block.lanes!.find(l=>l.id==='extension')!.studentIds).toEqual(['stu-01']);
    expect(next.changes.some(c=>c.operation==='schedule_checkpoint')).toBe(false);
    apply(state,next);expect(JSON.stringify(state.planVersions.find(v=>v.id===original.planVersionId))).toBe(snapshot);
    expect(()=>proposal(state,'lesson-2026-09-23')).toThrow(/Do not rewrite/);
  });
  it('targets each later authored lesson and never automatically confirms sample findings',()=>{
    const state=createInitialState('teacher');
    for(const assignment of assignments.slice(2)){
      const batch=seedAssignment(state,assignment.templateId,{studentIds:['stu-01']});analyzeBatch(state,{batchId:batch.id,provenance:testProvenance});
      expect(state.findings.filter(f=>f.batchId===batch.id).every(f=>f.status==='candidate')).toBe(true);
      confirm(state,batch.id);const next=proposal(state,assignment.targetLessonId);
      expect(state.plans.find(p=>p.id===next.lessonId)!.date>batch.activityDate).toBe(true);
    }
  });
  it('offers only explicitly authored future checkpoint allocations',()=>{
    const state=createInitialState('teacher');
    expect(getEligibleCheckpoints(state,'lesson-2026-09-23')).toMatchObject([{calendarEntryId:'calendar-2026-09-24',templateId:'followup-template-v1',minutes:8,offsetMinutes:0}]);
    expect(getEligibleCheckpoints(state,'lesson-2026-09-25')).toEqual([]);
    expect(getEligibleCheckpoints(state,'lesson-2026-09-28')).toEqual([]);
    state.calendarEntries.find(e=>e.id==='calendar-2026-09-24')!.locked=true;
    expect(getEligibleCheckpoints(state,'lesson-2026-09-23')).toEqual([]);
  });
});
