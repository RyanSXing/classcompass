import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { AIError, analyzeEvidence, buildAnalysisInput, buildExtractionInput, buildProposalInput, extractWorksheet, proposeLesson } from '@/lib/server/ai';
import { createInitialState, createBatch, ingestExtraction, analyzeBatch, reviewFindings } from '@/lib/domain';
import type { AppState, ExtractionDraft } from '@/lib/contracts';
const owner='11111111-1111-4111-8111-111111111111';
const good:ExtractionDraft={templateId:'baseline-template-v1',responses:['q-01','q-02','q-03','q-04'].map(questionId=>({questionId,workingText:'',answerText:null,legibility:'blank',alternatives:[],uncertaintyNote:null}))};
const input={assetHash:'unrecognized',bytes:Buffer.from('image'),mimeType:'image/png',templateId:'baseline-template-v1'};
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
function setup(){ const state=createInitialState(owner),time=new Date().toISOString();state.assets.push({id:'asset-test',ownerId:owner,createdAt:time,updatedAt:time,revision:1,purpose:'worksheet',name:'student.png',status:'ready',mimeType:'image/png',byteCount:1,originalObjectKey:'private/student.png',templateId:'baseline-template-v1'});const batch=createBatch(state,{templateId:'baseline-template-v1',activityDate:'2026-09-22',kind:'baseline',submissions:[{studentId:'stu-08',assetId:'asset-test',support:{level:'independent',source:'teacher-recorded',note:'No help'}}]});ingestExtraction(state,{submissionId:batch.submissionIds[0],draft:good,assetHash:'hash',provenance:{mode:'fixture',modelId:'test',promptVersion:'test',generatedAt:time,inputFingerprint:'test'}});return{state,batchId:batch.id}; }
function mockCompletion(content:unknown,finish='stop'){const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:typeof content==='string'?content:JSON.stringify(content)},finish_reason:finish}]}),{status:200}));vi.stubGlobal('fetch',fetcher);vi.stubEnv('OPENROUTER_API_KEY','test-key-never-display');return fetcher;}
describe('AI provider boundary',()=>{
 it('extracts recognized hash only, preserving prepared simulation disclosure',async()=>{const records=JSON.parse(await readFile('lib/fixtures/extractions.json','utf8'));const entry=Object.entries(records).find(([,v])=>(v as {studentId:string;templateId:string}).studentId==='stu-06'&&(v as {templateId:string}).templateId==='baseline-template-v1')!;const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const result=await extractWorksheet({...input,assetHash:entry[0],mode:'fixture'});expect(result.draft.responses[2].answerText).toBe('1/5');expect(result.draft.responses[2].legibility).toBe('uncertain');expect(result.draft.responses[2].uncertaintyNote).toContain('simulated');expect(fetcher).not.toHaveBeenCalled();await expect(extractWorksheet({...input,mode:'fixture'})).rejects.toMatchObject({code:'AI_FIXTURE_UNSUPPORTED',retryable:false});});
 it('sends image with known prompts and no answer key, scenarios or names',async()=>{const fetcher=mockCompletion(good);await extractWorksheet({...input,mode:'live'});expect(fetcher).toHaveBeenCalledTimes(1);const request=JSON.parse(fetcher.mock.calls[0][1].body);expect(fetcher.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');expect(request.model).toBe('google/gemma-4-26b-a4b-it:free');expect(request.response_format).toEqual({type:'json_object'});expect(request.messages[1].content[1].image_url.url).toMatch(/^data:image\/png;base64,/);const text=JSON.stringify(request.messages);for(const forbidden of ['expectedAnswer','groundTruth','writtenAnswer','baselineScenarios','Avery','Finley'])expect(text).not.toContain(forbidden);expect(buildExtractionInput('baseline-template-v1').questions).toHaveLength(4);});
 it('keeps live accurate Finley reading instead of injecting fixture error',async()=>{const draft=structuredClone(good);draft.responses[2]={questionId:'q-03',workingText:'2/5 = 4/10; 4/10 + 1/10 = 5/10 = 1/2',answerText:'1/2',legibility:'clear',alternatives:[],uncertaintyNote:null};mockCompletion(draft);const records=JSON.parse(await readFile('lib/fixtures/extractions.json','utf8'));const key=Object.keys(records).find(k=>records[k].studentId==='stu-06')!;const result=await extractWorksheet({...input,assetHash:key,mode:'live'});expect(result.draft.responses[2].answerText).toBe('1/2');expect(result.provenance.mode).toBe('live');});
 it.each([{status:401,code:'AI_AUTH',retryable:false},{status:429,code:'AI_RATE_LIMIT',retryable:true},{status:404,code:'AI_MODEL_UNAVAILABLE',retryable:false},{status:503,code:'AI_PROVIDER',retryable:true}])('maps $status safely with no fallback or raw body',async({status,code,retryable})=>{vi.stubEnv('OPENROUTER_API_KEY','secret-marker');const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{message:'private-secret-provider-text'}}),{status,headers:{'retry-after':'7'}}));vi.stubGlobal('fetch',fetcher);try{await extractWorksheet({...input,mode:'live'});throw new Error('Expected failure');}catch(error){expect(error).toBeInstanceOf(AIError);expect(error).toMatchObject({code,retryable});expect((error as Error).message).not.toContain('private-secret');}expect(fetcher).toHaveBeenCalledTimes(1);});
 it('does not retry exhausted daily quota',async()=>{vi.stubEnv('OPENROUTER_API_KEY','test');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{message:'Daily quota exhausted'}}),{status:429})));await expect(extractWorksheet({...input,mode:'live'})).rejects.toMatchObject({code:'AI_QUOTA',retryable:false});});
 it('rejects duplicate questions, invented blank writing, malformed and truncated JSON',async()=>{for(const [draft,finish,code] of [[{...good,responses:[good.responses[0],good.responses[0],good.responses[2],good.responses[3]]},'stop','AI_QUESTION_IDS'],[{...good,responses:good.responses.map(r=>({...r,workingText:'invented'}))},'stop','AI_BLANK_CONTRACT'],['{','stop','AI_INVALID_JSON'],[good,'length','AI_TRUNCATED']] as const){mockCompletion(draft,finish);await expect(extractWorksheet({...input,mode:'live'})).rejects.toMatchObject({code});}});
 it('does not send identity, private raw extraction or hidden state into analysis',()=>{const{state,batchId}=setup();(state as AppState&{groundTruth:string}).groundTruth='DO_NOT_SEND';state.students[7].displayName='Secret Name';state.assets[0].originalObjectKey='private-storage-secret';state.extractions[0].raw.responses[0].workingText='DISCARDED-RAW-READING';const body=JSON.stringify(buildAnalysisInput(state,batchId));for(const forbidden of ['DO_NOT_SEND','Secret Name','private-storage-secret','DISCARDED-RAW-READING','displayName','ownerId'])expect(body).not.toContain(forbidden);expect(body).toContain('No help');});
 it('keeps evidence and assistance grouped by student with checked facts from effective work',()=>{
  const{state,batchId}=setup(),context=buildAnalysisInput(state,batchId),student=context.studentWork[0];
  expect(student.studentId).toBe('stu-08');expect(student.support.note).toBe('No help');expect(student.currentResponseCount).toBe(4);
  expect(student.currentResponses.map(r=>r.responseId)).toEqual(state.responses.map(r=>r.id));
  expect(student.checkedEvidence.blank).toEqual(state.responses.map(r=>({responseId:r.id,responseRevision:r.revision})));
  expect(student.checkedEvidence.correctEquivalentReasoning).toEqual([]);expect(student.checkedEvidence.clearDenominatorAddition).toEqual([]);
  expect(context).not.toHaveProperty('responses');expect(context).not.toHaveProperty('expectedGroups');
 });
 it('revalidates legacy checks in model input without rewriting saved evidence',()=>{
  const {state,batchId}=setup(),response=state.responses[0];
  response.answerText='5/6';response.workingText='1/7 = 2/14; 5/6';response.legibility='clear';
  response.mathCheck={...response.mathCheck,status:'correct',equivalentReasoning:true};
  const before=JSON.stringify(response.mathCheck),context=buildAnalysisInput(state,batchId);
  expect(context.studentWork[0].checkedEvidence.correctEquivalentReasoning).toEqual([]);
  expect(context.studentWork[0].currentResponses[0].mathCheck.equivalentReasoning).toBe(false);
  expect(JSON.stringify(response.mathCheck)).toBe(before);
 });
 it('fixture analysis delegates recomputation without mutating state',async()=>{const{state,batchId}=setup();const before=JSON.stringify(state);const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const result=await analyzeEvidence({state,batchId,mode:'fixture'});expect(result.drafts).toBeUndefined();expect(result.provenance.modelId).toBe('deterministic-domain-fixture');expect(JSON.stringify(state)).toBe(before);expect(fetcher).not.toHaveBeenCalled();});
 it('disables optional reasoning only for bounded text analysis while leaving vision unchanged',async()=>{
  const{state,batchId}=setup();
  const finding={studentId:'stu-08',objectiveId:'obj-add-unlike-fractions',code:'insufficient_evidence',claimScope:'evidence_quality',explanation:'The responses are blank; collect completed work.',evidence:state.responses.map(r=>({responseId:r.id,responseRevision:r.revision})),limitations:['No completed response.'],suggestedNextStep:'gather_evidence'};
  const analysisFetch=mockCompletion({findings:[finding]});
  await analyzeEvidence({state,batchId,mode:'live'});
  const analysisRequest=JSON.parse(analysisFetch.mock.calls[0][1].body);
  expect(analysisRequest.reasoning).toEqual({enabled:false});expect(analysisRequest.response_format.type).toBe('json_schema');
  const lowFetch=mockCompletion({findings:[finding]});await analyzeEvidence({state,batchId,mode:'live',reasoningEffort:'low'});
  const lowRequest=JSON.parse(lowFetch.mock.calls[0][1].body);expect(lowRequest.reasoning).toEqual({effort:'low'});expect(lowRequest.max_tokens).toBe(6000);
  const visionFetch=mockCompletion(good);await extractWorksheet({...input,mode:'live'});
  expect(JSON.parse(visionFetch.mock.calls[0][1].body)).not.toHaveProperty('reasoning');
 });
 it('rejects live cross-student fabricated evidence without touching state',async()=>{const{state,batchId}=setup();const before=JSON.stringify(state);mockCompletion({findings:[{studentId:'stu-01',objectiveId:'obj-add-unlike-fractions',code:'insufficient_evidence',claimScope:'evidence_quality',explanation:'Missing work',evidence:[{responseId:state.responses[0].id,responseRevision:1}],limitations:[],suggestedNextStep:'gather_evidence'}]});await expect(analyzeEvidence({state,batchId,mode:'live'})).rejects.toMatchObject({code:'AI_FINDING_COVERAGE'});expect(JSON.stringify(state)).toBe(before);});
 it('retains domain diagnostics internally while keeping the public evidence failure message generic',async()=>{
  const{state,batchId}=setup();mockCompletion({findings:[{studentId:'stu-08',objectiveId:'obj-add-unlike-fractions',code:'equivalent_fraction_reasoning',claimScope:'independent_performance',explanation:'Unsupported independent success.',evidence:state.responses.map(r=>({responseId:r.id,responseRevision:r.revision})),limitations:[],suggestedNextStep:'independent_application'}]});
  try{await analyzeEvidence({state,batchId,mode:'live'});throw new Error('Expected validation failure');}catch(error){expect(error).toMatchObject({code:'AI_INVALID_EVIDENCE',cause:{code:'INVALID_FINDING'}});expect((error as Error).message).not.toContain('completed clear response');}
 });
 it('rejects misconception output that uses affirmative independent-success scope',async()=>{
  const{state,batchId}=setup();mockCompletion({findings:[{studentId:'stu-08',objectiveId:'obj-add-unlike-fractions',code:'denominator_addition',claimScope:'independent_performance',explanation:'Attempted without help.',evidence:state.responses.slice(0,2).map(r=>({responseId:r.id,responseRevision:r.revision})),limitations:[],suggestedNextStep:'targeted_equal_parts'}]});
  await expect(analyzeEvidence({state,batchId,mode:'live'})).rejects.toMatchObject({code:'AI_INVALID_OUTPUT'});
 });
});

describe('proposal model boundary',()=>{
 it('assigns server IDs, derives evidence links and validates the entire proposal before returning',async()=>{
  const{state,batchId}=setup();
  const provenance={mode:'fixture' as const,modelId:'test',promptVersion:'test',generatedAt:new Date().toISOString(),inputFingerprint:'test'};
  const findings=analyzeBatch(state,{batchId,provenance});
  reviewFindings(state,{items:findings.map(f=>({findingId:f.id,expectedRevision:f.revision,decision:'confirm' as const})),acknowledgeClearReadings:true});
  const before=JSON.stringify(state),f=findings[0];
  const common={changeKey:'draft-practice',rationale:'Collect missing evidence while students continue.',findingIds:[f.id],affectedStudentIds:state.students.map(s=>s.id),dependsOnKeys:[]};
  const block={id:'practice',title:'Check and continue',minutes:12,instructions:'Run all lanes concurrently.',mode:'concurrent',materialIds:[],lanes:[
   {id:'targeted',title:'Equal parts',studentIds:[],teacherLed:true,minutes:12,instructions:'Use strips.',materialIds:['targeted-equal-parts-v1'],entryCheckStudentIds:[]},
   {id:'independent',title:'Check and apply',studentIds:state.students.map(s=>s.id),teacherLed:false,minutes:12,instructions:'Collect a short independent response.',materialIds:['entry-check-v1','application-practice-v1'],entryCheckStudentIds:state.students.map(s=>s.id)},
   {id:'extension',title:'Explain two methods',studentIds:[],teacherLed:false,minutes:12,instructions:'Compare methods.',materialIds:['extension-explain-v1'],entryCheckStudentIds:[]},
  ]};
  const fetcher=mockCompletion({changes:[{...common,operation:'replace_practice',payload:{block}}]});
  const result=await proposeLesson({state,lessonId:'lesson-2026-09-23',mode:'live'});
  expect(result.changes![0].id).toMatch(/^change-/);expect(result.changes![0].id).not.toBe(common.changeKey);expect(result.changes![0].evidence).toEqual(f.evidence);expect(JSON.stringify(state)).toBe(before);
  const request=JSON.parse(fetcher.mock.calls[0][1].body);expect(request.response_format.type).toBe('json_schema');expect(request.provider.require_parameters).toBe(true);expect(request.reasoning).toEqual({enabled:false});
  const payload=JSON.stringify(buildProposalInput(state,'lesson-2026-09-23'));expect(payload).not.toContain('displayName');expect(payload).not.toContain('"raw":');
  mockCompletion({changes:[{...common,operation:'replace_practice',payload:{block:{...block,id:'practice-renamed'}}}]});await expect(proposeLesson({state,lessonId:'lesson-2026-09-23',mode:'live'})).rejects.toMatchObject({code:'AI_INVALID_OUTPUT'});
  mockCompletion({changes:[{...common,operation:'replace_practice',payload:{block:{...block,materialIds:['invented-activity']}}}]});await expect(proposeLesson({state,lessonId:'lesson-2026-09-23',mode:'live'})).rejects.toMatchObject({code:'AI_INVALID_OUTPUT'});
  block.lanes[1].studentIds=block.lanes[1].studentIds.slice(1);block.lanes[1].entryCheckStudentIds=block.lanes[1].studentIds;
  mockCompletion({changes:[{...common,operation:'replace_practice',payload:{block}}]});await expect(proposeLesson({state,lessonId:'lesson-2026-09-23',mode:'live'})).rejects.toMatchObject({code:'AI_INVALID_PLAN'});
 });
 it('rejects missing credentials and paid endpoints before any fetch',async()=>{const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);vi.stubEnv('OPENROUTER_API_KEY','');await expect(extractWorksheet({...input,mode:'live'})).rejects.toMatchObject({code:'AI_KEY_MISSING',retryable:false});vi.stubEnv('OPENROUTER_API_KEY','test');vi.stubEnv('OPENROUTER_VISION_MODEL','paid/model');await expect(extractWorksheet({...input,mode:'live'})).rejects.toMatchObject({code:'AI_MODEL_COST',retryable:false});expect(fetcher).not.toHaveBeenCalled();});
});
