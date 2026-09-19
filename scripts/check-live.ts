/** Authorized, bounded live evaluation of the public fictional scans. Never logs secrets. */
import { config as loadEnv } from 'dotenv';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { AIError, extractWorksheet, analyzeEvidence, proposeLesson } from '../lib/server/ai';
import { configuration, LOCAL_OWNER } from '../lib/server/config';
import { createInitialState, createBatch, ingestExtraction, analyzeBatch, correctSupport, reviewFindings, generateProposal, applyProposal, equalFractions, parseFraction } from '../lib/domain';
import type { ExtractionDraft, Finding, AppState } from '../lib/contracts';

loadEnv({path:'.env.local',quiet:true});
const reasoningSmoke=process.argv.includes('--reasoning-smoke');
const smoke=process.argv.includes('--smoke')||reasoningSmoke;
const output=path.join('.local',reasoningSmoke?'live-reasoning-smoke.json':smoke?'live-smoke.json':'live-evaluation.json');
const record:{startedAt:string;mode:string;models:unknown;calls:number;catalog?:unknown;pages:unknown[];stages:unknown[];summary?:unknown;error?:unknown;completedAt?:string}={startedAt:new Date().toISOString(),mode:smoke?'live-smoke':'live-evaluation',models:{vision:configuration().visionModel,reasoning:configuration().reasoningModel},calls:0,pages:[],stages:[]};
let lastDispatch=0;
async function persist(){await mkdir('.local',{recursive:true});await writeFile(output,JSON.stringify(record,null,2)+'\n');}
async function call<T>(fn:()=>Promise<T>){await delay(Math.max(0,4000-(Date.now()-lastDispatch)));lastDispatch=Date.now();record.calls++;try{return await fn();}finally{await persist();}}
const normalized=(text:string|null)=> (text??'').toLowerCase().replace(/[\s;.,]/g,'');
function answerAgreement(actual:string|null,reference:string|null){if(actual===null||reference===null)return actual===reference;const a=parseFraction(actual),b=parseFraction(reference);return a&&b?equalFractions(a,b)&&/meter/.test(actual)===/meter/.test(reference):normalized(actual)===normalized(reference);}
function safeError(error:unknown){return error instanceof AIError?{code:error.code,message:error.message,retryable:error.retryable,retryAfterMs:error.retryAfterMs}:{code:'EVALUATION_FAILED',message:'Evaluation stopped at a validation or local data step. Inspect the test setup; no production classroom state was changed.'};}
function reviewEligible(state:AppState,findings:Finding[]){const reviewed:string[]=[],unreviewed:string[]=[];for(const f of findings){try{reviewFindings(state,{items:[{findingId:f.id,expectedRevision:f.revision,decision:'confirm'}],acknowledgeClearReadings:true,reason:'Automated synthetic evaluation only; not a real teacher review.'});reviewed.push(f.id);}catch{unreviewed.push(f.id);}}return{reviewed,unreviewed};}
async function catalogCheck(){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const response=await fetch('https://openrouter.ai/api/v1/models',{signal:controller.signal});if(!response.ok)throw new AIError('CATALOG_UNAVAILABLE','Could not verify the configured free model catalog.',false);const catalog=await response.json() as {data:{id:string;architecture:{input_modalities:string[]};pricing:{prompt:string;completion:string};supported_parameters:string[]}[]};const cfg=configuration();const selected=[cfg.visionModel,cfg.reasoningModel].map(id=>catalog.data.find(m=>m.id===id));if(selected.some(m=>!m))throw new AIError('MODEL_CATALOG_MISSING','A configured free model is missing from the current catalog. No substitution was attempted.',false);const[vision,reasoning]=selected;if(!vision!.architecture.input_modalities.includes('image')||!vision!.supported_parameters.includes('response_format')||!reasoning!.supported_parameters.includes('structured_outputs'))throw new AIError('MODEL_CAPABILITY','A configured endpoint does not advertise the required image or structured-output capability.',false);if(selected.some(m=>Number(m!.pricing.prompt)!==0||Number(m!.pricing.completion)!==0))throw new AIError('MODEL_COST','A configured endpoint is no longer free; no completion request was made.',false);record.catalog=selected.map(m=>({id:m!.id,inputModalities:m!.architecture.input_modalities,pricing:m!.pricing,supportedParameters:m!.supported_parameters}));}finally{clearTimeout(timer);}
}
async function main(){
 await persist();await catalogCheck();
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
