/** Authorized, bounded live evaluation of the public fictional scans. Never logs secrets. */
import { config as loadEnv } from 'dotenv';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { AIError, extractWorksheet, analyzeEvidence, proposeLesson } from '../lib/server/ai';
import { configuration, LOCAL_OWNER } from '../lib/server/config';
import { createInitialState, createBatch, ingestExtraction, analyzeBatch, correctSupport, reviewFindings, generateProposal, applyProposal, equalFractions, parseFraction, DomainError } from '../lib/domain';
import type { ExtractionDraft, Finding, AppState } from '../lib/contracts';

loadEnv({path:'.env.local',quiet:true});
const reasoningSmoke=process.argv.includes('--reasoning-smoke');
const reasoningEvaluation=process.argv.includes('--reasoning-evaluation');
const reasoningPhase=process.argv.includes('--followup')?'followup':'baseline';
const reasoningEffort=process.argv.includes('--low')?'low':'disabled';
const smoke=process.argv.includes('--smoke')||reasoningSmoke;
const output=path.join('.local',reasoningEvaluation?`live-${reasoningPhase==='followup'?'followup-':''}reasoning-${reasoningEffort==='low'?'low-':''}evaluation.json`:reasoningSmoke?'live-reasoning-smoke.json':smoke?'live-smoke.json':'live-evaluation.json');
const record:{startedAt:string;mode:string;models:unknown;calls:number;catalog?:unknown;pages:unknown[];stages:unknown[];providerResponses?:unknown[];summary?:unknown;error?:unknown;completedAt?:string}={startedAt:new Date().toISOString(),mode:reasoningEvaluation?'live-text-evaluation':smoke?'live-smoke':'live-evaluation',models:{vision:configuration().visionModel,reasoning:configuration().reasoningModel},calls:0,pages:[],stages:[]};
let lastDispatch=0;
async function persist(){await mkdir('.local',{recursive:true});await writeFile(output,JSON.stringify(record,null,2)+'\n',{mode:0o600});}
async function call<T>(fn:()=>Promise<T>){
 await delay(Math.max(0,4000-(Date.now()-lastDispatch)));lastDispatch=Date.now();record.calls++;
 const originalFetch=globalThis.fetch;
 // Private synthetic-output diagnostics only: never capture request headers,
 // credentials, prompts, cookies, URLs with tokens, or raw provider errors.
 if(reasoningEvaluation)globalThis.fetch=async(input,init)=>{
  const response=await originalFetch(input,init);
  if(String(input)==='https://openrouter.ai/api/v1/chat/completions'&&response.ok){
   const body=await response.clone().json() as {model?:string;usage?:unknown;choices?:{finish_reason?:string;message?:{content?:string}}[]};
   const choice=body.choices?.[0];let content:unknown=choice?.message?.content;
   if(typeof content==='string'){try{content=JSON.parse(content);}catch{/* Retain malformed synthetic content for diagnosis. */}}
   (record.providerResponses??=[]).push({model:body.model,status:response.status,finishReason:choice?.finish_reason,usage:body.usage,content});
  }
  return response;
 };
 try{return await fn();}finally{globalThis.fetch=originalFetch;await persist();}
}
const normalized=(text:string|null)=> (text??'').toLowerCase().replace(/[\s;.,]/g,'');
function answerAgreement(actual:string|null,reference:string|null){if(actual===null||reference===null)return actual===reference;const a=parseFraction(actual),b=parseFraction(reference);return a&&b?equalFractions(a,b)&&/meter/.test(actual)===/meter/.test(reference):normalized(actual)===normalized(reference);}
function safeError(error:unknown){return error instanceof AIError?{code:error.code,message:error.message,retryable:error.retryable,retryAfterMs:error.retryAfterMs,...(error.cause instanceof DomainError?{validation:{code:error.cause.code,message:error.cause.message}}:{})}:{code:'EVALUATION_FAILED',message:'Evaluation stopped at a validation or local data step. Inspect the test setup; no production classroom state was changed.'};}
function reviewEligible(state:AppState,findings:Finding[]){const reviewed:string[]=[],unreviewed:string[]=[];for(const f of findings){try{reviewFindings(state,{items:[{findingId:f.id,expectedRevision:f.revision,decision:'confirm'}],acknowledgeClearReadings:true,reason:'Automated synthetic evaluation only; not a real teacher review.'});reviewed.push(f.id);}catch{unreviewed.push(f.id);}}return{reviewed,unreviewed};}
async function catalogCheck(){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch('https://openrouter.ai/api/v1/models',{signal:controller.signal});if(!response.ok)throw new AIError('CATALOG_UNAVAILABLE','Could not verify the configured free model catalog.',false);const catalog=await response.json() as {data:{id:string;architecture:{input_modalities:string[]};pricing:{prompt:string;completion:string};supported_parameters:string[]}[]};const cfg=configuration();const selected=[cfg.visionModel,cfg.reasoningModel].map(id=>catalog.data.find(m=>m.id===id));if(selected.some(m=>!m))throw new AIError('MODEL_CATALOG_MISSING','A configured free model is missing from the current catalog. No substitution was attempted.',false);const[vision,reasoning]=selected;if(!vision!.architecture.input_modalities.includes('image')||!vision!.supported_parameters.includes('response_format')||!reasoning!.supported_parameters.includes('structured_outputs'))throw new AIError('MODEL_CAPABILITY','A configured endpoint does not advertise the required image or structured-output capability.',false);if(selected.some(m=>Number(m!.pricing.prompt)!==0||Number(m!.pricing.completion)!==0))throw new AIError('MODEL_COST','A configured endpoint is no longer free; no completion request was made.',false);record.catalog=selected.map(m=>({id:m!.id,inputModalities:m!.architecture.input_modalities,pricing:m!.pricing,supportedParameters:m!.supported_parameters}));}finally{clearTimeout(timer);}
}
async function main(){
 if(!reasoningEvaluation&&(process.argv.includes('--low')||process.argv.includes('--followup')))throw new AIError('EVALUATION_MODE','Use --reasoning-evaluation with --low or --followup for the explicit text-only evaluation.',false);
 await persist();await catalogCheck();
 if(reasoningEvaluation){
  // Text-only evaluation on a clone of teacher-corrected fictional demo state.
  // No OCR, production mutation, hidden reference answers or ground-truth groups.
  const sourcePath=process.env.LIVE_REASONING_STATE_FILE||(reasoningPhase==='followup'?'.local/e2e/state.json':'.local/classcompass/state.json');
  const saved=JSON.parse(await readFile(sourcePath,'utf8')) as AppState;
  const batch=saved.batches.filter(b=>b.kind===reasoningPhase).at(-1),lessonId=reasoningPhase==='followup'?'lesson-2026-09-25':'lesson-2026-09-23';
  if(!batch||batch.submissionIds.length!==8)throw new AIError('EVALUATION_STATE',`Load and review the eight fictional ${reasoningPhase} worksheets before this text-only evaluation.`,false);
  const corrected=structuredClone(saved),comparison=saved.findings.filter(f=>f.batchId===batch.id&&f.status==='confirmed');
  const ids=new Set(corrected.findings.filter(f=>f.batchId===batch.id).map(f=>f.id));
  corrected.findings=corrected.findings.filter(f=>f.batchId!==batch.id);corrected.observations=corrected.observations.filter(o=>!ids.has(o.findingId));
  let analysisPassed=false,proposalPassed=false,agreements=0,analysisFindings=0;
  let proposalState=structuredClone(saved),proposalInput=`Previously teacher-confirmed ${reasoningPhase} findings in the fictional demo`;
  const start=Date.now();
  try{
   const result=await call(()=>analyzeEvidence({state:corrected,batchId:batch.id,mode:'live',reasoningEffort}));
   const findings=analyzeBatch(corrected,{batchId:batch.id,...result}),review=reviewEligible(corrected,findings);
   const outcomes=corrected.submissions.filter(s=>s.batchId===batch.id).map(s=>{const expected=comparison.filter(f=>f.studentId===s.studentId).map(f=>f.suggestedNextStep),actual=findings.filter(f=>f.studentId===s.studentId).map(f=>f.suggestedNextStep);return{studentId:s.studentId,teacherConfirmedNextSteps:expected,liveNextSteps:actual,agrees:expected.some(next=>actual.includes(next))};});
   agreements=outcomes.filter(o=>o.agrees).length;analysisFindings=findings.length;analysisPassed=true;
   record.stages.push({kind:`live-${reasoningPhase}-analysis`,durationMs:Date.now()-start,provenance:result.provenance,findings:result.drafts,review,outcomes,domainValidated:true});
   if(!review.unreviewed.length){proposalState=corrected;proposalInput='Live analysis findings confirmed by automated synthetic evaluation, not by an external teacher';}
   console.log(`Live ${reasoningPhase} analysis passed domain validation: ${findings.length} findings; ${agreements}/8 next-step agreements with saved teacher decisions.`);
  }catch(error){record.stages.push({kind:`live-${reasoningPhase}-analysis`,durationMs:Date.now()-start,error:safeError(error)});console.log(`Live ${reasoningPhase} analysis failed: ${(safeError(error) as {code:string}).code}`);}
  const proposedAt=Date.now();
  if(reasoningEffort==='disabled'||analysisPassed){
  try{
   const result=await call(()=>proposeLesson({state:proposalState,lessonId,mode:'live',reasoningEffort}));
   const plan=proposalState.plans.find(p=>p.id===lessonId)!;
   const proposal=generateProposal(proposalState,plan.id,{...result,basePlanVersionId:plan.currentVersionId,expectedEvidenceRevision:proposalState.classroom.evidenceRevision,expectedCalendarRevision:proposalState.classroom.calendarRevision});
   const applied=applyProposal(proposalState,proposal.id,{expectedRevision:proposal.revision,basePlanVersionId:proposal.basePlanVersionId,expectedEvidenceRevision:proposal.evidenceRevision,expectedCalendarRevision:proposal.calendarRevision,selectedChangeIds:proposal.changes.map(c=>c.id)});
   const accepted=proposalState.planVersions.find(v=>v.id===applied.planVersionId)!;
   proposalPassed=true;record.stages.push({kind:`live-${reasoningPhase}-proposal`,durationMs:Date.now()-proposedAt,provenance:result.provenance,inputDisclosure:proposalInput,changes:result.changes,domainValidated:true,simulatedApplication:true,totalMinutes:accepted.snapshot.blocks.reduce((n,b)=>n+b.minutes,0),practiceLanes:accepted.snapshot.blocks.find(b=>b.id==='practice')?.lanes});
   console.log(`Live proposal passed domain validation and cloned-state application: ${proposal.changes.length} changes; 45-minute lesson.`);
  }catch(error){record.stages.push({kind:`live-${reasoningPhase}-proposal`,durationMs:Date.now()-proposedAt,inputDisclosure:proposalInput,error:safeError(error)});console.log(`Live proposal failed: ${(safeError(error) as {code:string}).code}`);}
  }else record.stages.push({kind:`live-${reasoningPhase}-proposal`,skipped:true,reason:'The low-effort analysis did not pass; no additional provider call was made.'});
  record.summary={phase:reasoningPhase,reasoningEffort,analysisPassed,proposalPassed,analysisFindings,nextStepAgreement:{count:agreements,total:8},scansEvaluated:0,handwritingEvaluated:false,externalTeacherValidated:false,productionStateMutated:false,note:'Real text-model calls on already transcribed and teacher-corrected fictional work. This does not evaluate handwriting or classroom effectiveness.'};record.completedAt=new Date().toISOString();await persist();console.log(`Saved ${output}; ${record.calls} text calls and zero vision calls.`);if(!analysisPassed||!proposalPassed)process.exitCode=1;return;
 }
 if(reasoningSmoke){
  const state=createInitialState(LOCAL_OWNER),time=new Date().toISOString();
  state.assets.push({id:'manual-blank-smoke',ownerId:LOCAL_OWNER,createdAt:time,updatedAt:time,revision:1,purpose:'worksheet',name:'explicit-manual-blank-smoke',status:'ready',mimeType:'image/png',byteCount:0,originalObjectKey:'none',templateId:'baseline-template-v1'});
  const batch=createBatch(state,{templateId:'baseline-template-v1',activityDate:'2026-09-22',kind:'baseline',submissions:[{assetId:'manual-blank-smoke',studentId:'stu-08',support:{level:'independent',source:'teacher-recorded',note:'Explicit synthetic all-blank provider health check.'}}]});
  const draft:ExtractionDraft={templateId:'baseline-template-v1',responses:['q-01','q-02','q-03','q-04'].map(questionId=>({questionId,workingText:'',answerText:null,legibility:'blank',alternatives:[],uncertaintyNote:null}))};
  ingestExtraction(state,{submissionId:batch.submissionIds[0],draft,assetHash:'manual-smoke-only',provenance:{mode:'fixture',modelId:'explicit-manual-blank-smoke',promptVersion:'smoke-v1',generatedAt:time,inputFingerprint:'manual-smoke'}});
  const result=await call(()=>analyzeEvidence({state,batchId:batch.id,mode:'live'}));
  record.stages.push({kind:'structured-analysis-health',provenance:result.provenance,findings:result.drafts});record.summary={handwritingEvaluated:false,modelQualityEvaluated:false,note:'Independent structured-output transport check on explicitly authored blank responses; no reference student answers or fixture predictions used.'};record.completedAt=new Date().toISOString();await persist();console.log(`Reasoning structured-output smoke passed; saved ${output}`);return;
 }
 const manifest=JSON.parse(await readFile('public/demo/manifest.json','utf8')) as {assets:{id:string;filename:string;sha256:string;type:string;studentId?:string;templateId?:string}[]};
 // Reference transcripts are used ONLY by this evaluator after live responses return.
 const fixtures=JSON.parse(await readFile('lib/fixtures/extractions.json','utf8')) as Record<string,{templateId:string;studentId:string;responses:ExtractionDraft['responses'];preparedCorrection?:string}>;
 const authored=JSON.parse(await readFile('docs/fixtures/classroom.json','utf8')) as {students:{id:string;baseline:{responses:{questionId:string;writtenAnswer:string|null}[]};followup:{responses:{questionId:string;writtenAnswer:string|null}[]}}[]};
 const state=createInitialState(LOCAL_OWNER);let previousBatchId:string|undefined,sourcePlanVersionId:string|undefined;
 let total=0,correctAnswers=0,exactWorking=0,uncertain=0,misreadAbstentions=0,misreads=0;
 for(const stage of smoke?['baseline']:['baseline','followup']){
  const assets=manifest.assets.filter(a=>a.type==='fictional-handwritten-scan'&&a.id.startsWith(stage)).slice(0,smoke?1:8);
  const time=new Date().toISOString();
  for(const a of assets)state.assets.push({id:a.id,ownerId:LOCAL_OWNER,createdAt:time,updatedAt:time,revision:1,purpose:'worksheet',name:a.filename,status:'ready',mimeType:'image/png',byteCount:1,originalObjectKey:a.filename,sha256:a.sha256,templateId:a.templateId,studentId:a.studentId});
  const batch=createBatch(state,{templateId:`${stage}-template-v1`,activityDate:stage==='baseline'?'2026-09-22':'2026-09-24',kind:stage as 'baseline'|'followup',sourcePlanVersionId,previousBatchId,submissions:assets.map(a=>({assetId:a.id,studentId:a.studentId!,support:{level:'independent' as const,source:'teacher-recorded' as const,note:'Synthetic evaluation condition: completed independently.'}}))});
  for(const asset of assets){
   const start=Date.now();const bytes=await readFile(path.join('public/demo',asset.filename));
   const result=await call(()=>extractWorksheet({assetHash:asset.sha256,bytes,mimeType:'image/png',templateId:asset.templateId!,mode:'live'}));
   ingestExtraction(state,{submissionId:state.submissions.find(s=>s.batchId===batch.id&&s.studentId===asset.studentId)!.id,draft:result.draft,provenance:result.provenance,assetHash:asset.sha256});
   const reference=fixtures[asset.sha256],source=authored.students.find(s=>s.id===asset.studentId)![stage as 'baseline'|'followup'];
   const responses=result.draft.responses.map(r=>{const expected=reference.responses.find(x=>x.questionId===r.questionId)!,visible=source.responses.find(x=>x.questionId===r.questionId)!.writtenAnswer,expectedAnswer=stage==='baseline'&&asset.studentId==='stu-06'&&r.questionId==='q-03'?'1/2':expected.answerText;const agrees=Boolean(answerAgreement(r.answerText,expectedAnswer)),working=normalized(r.workingText)===normalized(visible);total++;if(agrees)correctAnswers++;else{misreads++;if(r.legibility==='uncertain')misreadAbstentions++;}if(working)exactWorking++;if(r.legibility==='uncertain')uncertain++;return{questionId:r.questionId,answerAgreement:agrees,exactNormalizedWorking:working,legibility:r.legibility,expectedAnswer,actualAnswer:r.answerText,referenceWorking:visible,actualWorking:r.workingText,uncertaintyNote:r.uncertaintyNote};});
   record.pages.push({assetId:asset.id,templateId:asset.templateId,studentId:asset.studentId,durationMs:Date.now()-start,provenance:result.provenance,responses});await persist();console.log(`${asset.id}: ${responses.filter(r=>r.answerAgreement).length}/${responses.length} answers agree`);
  }
  // Explicit synthetic metadata correction, matching the agreed demo. This does not alter answers.
  if(!smoke&&stage==='baseline'){const gray=state.submissions.find(s=>s.batchId===batch.id&&s.studentId==='stu-07')!;correctSupport(state,gray.id,{expectedRevision:gray.revision,support:{level:'supported',source:'teacher-corrected',note:'I prompted Gray to find a common denominator on each question.'},reason:'Scripted synthetic evaluation of the teacher-context correction.'});}
  try{
   const result=await call(()=>analyzeEvidence({state,batchId:batch.id,mode:'live'}));const findings=analyzeBatch(state,{batchId:batch.id,...result});const review=reviewEligible(state,findings);
   const expected=stage==='baseline'?{'stu-01':'targeted_equal_parts','stu-02':'targeted_equal_parts','stu-03':'targeted_equal_parts','stu-04':'extension','stu-05':'extension','stu-06':'extension','stu-07':'independent_check','stu-08':'gather_evidence'}:{'stu-01':'independent_application','stu-02':'independent_application','stu-03':'targeted_equal_parts','stu-04':'extension','stu-05':'extension','stu-06':'extension','stu-07':'independent_application','stu-08':'gather_evidence'};
   const outcomes=assets.map(a=>({studentId:a.studentId,expectedNextStep:expected[a.studentId! as keyof typeof expected],actualNextSteps:findings.filter(f=>f.studentId===a.studentId).map(f=>f.suggestedNextStep),agrees:findings.some(f=>f.studentId===a.studentId&&f.suggestedNextStep===expected[a.studentId! as keyof typeof expected])}));
   const stageResult:{stage:string;analysisProvenance:unknown;outcomes:unknown;review:unknown;proposal?:unknown}={stage,analysisProvenance:result.provenance,outcomes,review};record.stages.push(stageResult);
   if(!smoke){const lessonId=stage==='baseline'?'lesson-2026-09-23':'lesson-2026-09-25';const proposed=await call(()=>proposeLesson({state,lessonId,mode:'live'}));const plan=state.plans.find(p=>p.id===lessonId)!;const proposal=generateProposal(state,lessonId,{...proposed,basePlanVersionId:plan.currentVersionId,expectedEvidenceRevision:state.classroom.evidenceRevision,expectedCalendarRevision:state.classroom.calendarRevision});const applied=applyProposal(state,proposal.id,{expectedRevision:proposal.revision,basePlanVersionId:proposal.basePlanVersionId,expectedEvidenceRevision:state.classroom.evidenceRevision,expectedCalendarRevision:state.classroom.calendarRevision,selectedChangeIds:proposal.changes.map(c=>c.id)});sourcePlanVersionId=applied.planVersionId;stageResult.proposal={provenance:proposed.provenance,operations:proposal.changes.map(c=>c.operation),validated:true,simulatedApplication:true};}
  }catch(error){record.stages.push({stage,error:safeError(error)});await persist();if(error instanceof AIError&&!error.retryable)throw error;}
  previousBatchId=batch.id;
 }
 record.summary={responses:total,answerAgreement:{count:correctAnswers,total},exactNormalizedWorking:{count:exactWorking,total},uncertainReadings:uncertain,misreadAbstention:{flagged:misreadAbstentions,totalMisreads:misreads},teacherReviewed:false,note:'All findings reviewed/applied by this script are automated synthetic evaluation steps, not an external teacher validation. Transcript comparisons and outcome expectations never enter live prompts.'};record.completedAt=new Date().toISOString();await persist();console.log(`Saved ${output}; ${record.calls} live calls; ${correctAnswers}/${total} final answers agree.`);
 if(record.stages.some(s=>Boolean((s as {error?:unknown}).error))||correctAnswers!==total)process.exitCode=1;
}
main().catch(async error=>{record.error=safeError(error);record.completedAt=new Date().toISOString();await persist();console.error(`${(record.error as {code:string}).code}: ${(record.error as {message:string}).message}`);console.error(`Saved ${output}`);process.exitCode=1;});
