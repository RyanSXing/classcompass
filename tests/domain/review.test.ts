import { describe, expect, it } from 'vitest';
import prepared from '../../lib/fixtures/extractions.json';
import type { AppState, Batch, CandidateFindingDraft, Provenance } from '../../lib/contracts';
import { extractionSchema } from '../../lib/contracts';
import { getQuestion } from '../../lib/curriculum';
import { analyzeBatch, applyProposal, checkMath, correctResponse, createBatch, createFinding, createInitialState, editFinding, editProposal, generateProposal, ingestExtraction, reviewFindings } from '../../lib/domain';
const provenance:Provenance={mode:'fixture',modelId:'review',promptVersion:'review',generatedAt:'2026-09-19T12:00:00Z',inputFingerprint:'review'};
function seed(state:AppState,kind:'baseline'|'followup'='baseline'){
 const templateId=`${kind}-template-v1`,entries=Object.entries(prepared).filter(([,entry])=>entry.templateId===templateId);
 for(const[hash,entry]of entries)state.assets.push({id:`${kind}-${entry.studentId}`,ownerId:state.ownerId,createdAt:provenance.generatedAt,updatedAt:provenance.generatedAt,revision:1,purpose:'worksheet',name:'page.png',status:'ready',mimeType:'image/png',byteCount:10,originalObjectKey:hash,sha256:hash,templateId});
 const batch=createBatch(state,{templateId,kind,activityDate:kind==='baseline'?'2026-09-22':'2026-09-24',submissions:entries.map(([,entry])=>({studentId:entry.studentId,assetId:`${kind}-${entry.studentId}`,support:{level:'independent',source:'teacher-recorded',note:'Independent synthetic response.'}}))});
 for(const submissionId of batch.submissionIds){const sub=state.submissions.find(s=>s.id===submissionId)!,[hash,entry]=entries.find(([,e])=>e.studentId===sub.studentId)!;ingestExtraction(state,{submissionId,draft:extractionSchema.parse({templateId,responses:entry.responses}),assetHash:hash,provenance});}
 return batch;
}
function responses(state:AppState,batch:Batch,studentId:string){const sub=state.submissions.find(s=>s.batchId===batch.id&&s.studentId===studentId)!;return state.responses.filter(r=>r.submissionId===sub.id);}
function refs(state:AppState,batch:Batch,studentId:string){return responses(state,batch,studentId).map(r=>({responseId:r.id,responseRevision:r.revision}));}
function confirm(state:AppState,f:ReturnType<typeof createFinding>){return reviewFindings(state,{items:[{findingId:f.id,expectedRevision:f.revision,decision:'confirm'}],acknowledgeClearReadings:true});}
function proposal(state:AppState){return generateProposal(state,'lesson-2026-09-23',{basePlanVersionId:state.plans[0].currentVersionId,expectedEvidenceRevision:state.classroom.evidenceRevision,expectedCalendarRevision:state.classroom.calendarRevision,provenance});}
function reviewed(){const state=createInitialState('teacher'),batch=seed(state);const findings=analyzeBatch(state,{batchId:batch.id,provenance});reviewFindings(state,{items:findings.map(f=>({findingId:f.id,expectedRevision:f.revision,decision:'confirm'})),acknowledgeClearReadings:true});return{state,batch};}
const teacherDraft=(evidence:CandidateFindingDraft['evidence']):CandidateFindingDraft=>({studentId:'stu-08',objectiveId:'obj-add-unlike-fractions',code:'other_teacher_finding',claimScope:'independent_performance',explanation:'An affirmative claim about the target skill.',evidence,limitations:[],suggestedNextStep:'independent_application'});
describe('independent domain review regressions',()=>{
 it('does not call a final arithmetic slip denominator addition after correct renaming',()=>{
  const math=checkMath(getQuestion('q-01'),'1/2 = 3/6; 1/3 = 2/6; 3/6 + 2/6 = 2/5','2/5','clear');
 expect(math.denominatorAddition).toBe(false);
 });
 it('retains an explicit denominator-addition error even when its wrong result is simplified correctly',()=>{
  expect(checkMath(getQuestion('q-03'),'2/5 + 1/10 = 3/15 = 1/5','1/5','clear').denominatorAddition).toBe(true);
 });
 it('clears resolved uncertainty from the effective reading while retaining extraction and revision history',()=>{
  const state=createInitialState('teacher'),batch=seed(state),response=responses(state,batch,'stu-06').find(r=>r.legibility==='uncertain')!;
  expect(response.uncertaintyNote).toBeTruthy();expect(response.alternatives.length).toBeGreaterThan(0);
  const extraction=state.extractions.find(e=>e.id===response.extractionId)!;
  correctResponse(state,response.id,{expectedRevision:response.revision,workingText:'2/5 = 4/10; 4/10 + 1/10 = 5/10 = 1/2',answerText:'1/2',legibility:'clear',readingStatus:'resolved',reason:'Teacher checked the original page.'});
  expect(response.uncertaintyNote).toBeNull();expect(response.alternatives).toEqual([]);
  expect(extraction.raw.responses.find(r=>r.questionId===response.questionId)?.uncertaintyNote).toBeTruthy();
  expect(state.responseRevisions[0].before.uncertaintyNote).toBeTruthy();
 });
 it('does not let a teacher-defined skill claim create independent success from blanks',()=>{const state=createInitialState('teacher'),batch=seed(state),f=createFinding(state,{...teacherDraft(refs(state,batch,'stu-08')),batchId:batch.id});expect(()=>confirm(state,f)).toThrow();expect(state.observations).toHaveLength(0);});
 it('does not let evidence_quality bypass targeted-instruction evidence gates',()=>{const state=createInitialState('teacher'),batch=seed(state),f=createFinding(state,{...teacherDraft(refs(state,batch,'stu-08')),claimScope:'evidence_quality',suggestedNextStep:'targeted_equal_parts',batchId:batch.id});expect(()=>confirm(state,f)).toThrow();});
 it('requires both fresh successes to continue extension rather than citing old success plus one blank',()=>{
  const{state}=reviewed(),followup=seed(state,'followup'),baseline=state.batches[0];
  // Harper has a blank follow-up; fabricate old Devon evidence as the same-student case to isolate freshness.
  const old=responses(state,baseline,'stu-04');const sub=state.submissions.find(s=>s.batchId===followup.id&&s.studentId==='stu-04')!;
  const current=responses(state,followup,'stu-04');current[1].workingText='';current[1].answerText=null;current[1].legibility='blank';current[1].mathCheck=checkMath(getQuestion('fq02'),'',null,'blank');
  const draft:CandidateFindingDraft={studentId:sub.studentId,objectiveId:'obj-add-unlike-fractions',code:'equivalent_fraction_reasoning',claimScope:'independent_performance',explanation:'Continue extension.',evidence:[...old.slice(0,3),current[1]].map(r=>({responseId:r.id,responseRevision:r.revision})),limitations:[],suggestedNextStep:'extension'};
  const finding=createFinding(state,{...draft,batchId:followup.id});expect(()=>confirm(state,finding)).toThrow();
 });
 it('rejects future work as evidence for an earlier dated finding',()=>{
  const state=createInitialState('teacher'),baseline=seed(state),followup=seed(state,'followup');
  const evidence=[...refs(state,baseline,'stu-04').slice(0,1),...refs(state,followup,'stu-04')];
  expect(()=>createFinding(state,{...teacherDraft(evidence),studentId:'stu-04',code:'equivalent_fraction_reasoning',suggestedNextStep:'extension',batchId:baseline.id})).toThrow();
 });
 it('requires edited follow-up findings to retain at least one fresh response',()=>{
  const state=createInitialState('teacher'),baseline=seed(state),followup=seed(state,'followup');const findings=analyzeBatch(state,{batchId:followup.id,provenance}),f=findings.find(f=>f.studentId==='stu-04')!;
  expect(()=>editFinding(state,f.id,{expectedRevision:f.revision,objectiveId:f.objectiveId,code:f.code,claimScope:f.claimScope,explanation:'Now based entirely on old work.',evidence:refs(state,baseline,'stu-04'),limitations:[],suggestedNextStep:'independent_application',reason:'Changed evidence.'})).toThrow();
 });
 it('requires replace_practice to preserve three concurrent pathways and roster coverage',()=>{
  const{state}=reviewed(),p=proposal(state),changes=structuredClone(p.changes),practice=changes.find(c=>c.operation==='replace_practice')!;
  if(practice.operation!=='replace_practice')throw Error();practice.payload.block.mode='whole_class';delete practice.payload.block.lanes;
  expect(()=>editProposal(state,p.id,{expectedRevision:p.revision,changes,reason:'Removed all pathways.'})).toThrow();
 });
 it('rejects accepted changes that omit the source evidence links',()=>{
  const{state}=reviewed(),p=proposal(state),changes=structuredClone(p.changes);changes[0].evidence=[];
  expect(()=>editProposal(state,p.id,{expectedRevision:p.revision,changes,reason:'Removed all evidence links.'})).toThrow();
 });
 it('keeps an accepted checkpoint printable available after a later lesson revision',()=>{
  const{state}=reviewed(),first=proposal(state);
  const apply=(p:typeof first,selectedChangeIds:string[])=>applyProposal(state,p.id,{expectedRevision:p.revision,basePlanVersionId:p.basePlanVersionId,expectedEvidenceRevision:p.evidenceRevision,expectedCalendarRevision:p.calendarRevision,selectedChangeIds});
  apply(first,first.changes.map(c=>c.id));
  const second=proposal(state);expect(second.changes.some(c=>c.operation==='schedule_checkpoint')).toBe(false);
  const result=apply(second,[second.changes.find(c=>c.operation==='replace_exit')!.id]);
  expect(state.materialSets.find(set=>set.id===result.materialSetId)?.materials.some(m=>m.id==='followup-template-v1')).toBe(true);
 });
});
