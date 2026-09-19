import { describe, expect, it } from 'vitest';
import { assignments } from '../../lib/assignments';
import { classifyResponse, currentAssignmentFindings, getAssignmentAnalytics, getCurrentSkillFindings, selectEffectiveSubmissions, selectResponseRevision } from '../../lib/analytics';
import { analyzeBatch, checkMath, correctResponse, correctSupport, createFinding, createInitialState, findingWarnings, getEffectiveResponse, getPlanningFindings, reviewFindings } from '../../lib/domain';
import { getQuestion } from '../../lib/curriculum';
import { seedAssignment, testProvenance } from './helpers';

describe('trustworthy response analytics', () => {
  it('accounts for every expected slot, including absent students and unprocessed pages', () => {
    const state = createInitialState('teacher');
    expect(getAssignmentAnalytics(state,'baseline-template-v1').counts).toMatchObject({ total: 32, not_received: 32, usable: 0, correctPercent: null });
    seedAssignment(state,'baseline-template-v1',{ studentIds: ['stu-01'], extract: false });
    const result = getAssignmentAnalytics(state,'baseline-template-v1');
    expect(result.counts).toMatchObject({ total: 32, unprocessed: 4, not_received: 28 });
    expect(result.submittedStudents).toBe(1);
    expect(result.expectedStudents).toBe(8);
  });
  it('reconciles all 120 response slots with disjoint buckets and explicit usable denominators', () => {
    const state = createInitialState('teacher');
    for (const assignment of assignments) seedAssignment(state,assignment.templateId);
    const results = assignments.map(a => getAssignmentAnalytics(state,a.templateId));
    expect(results.reduce((sum,a) => sum+a.counts.total,0)).toBe(120);
    for (const { counts } of results) {
      expect(counts.correct+counts.incorrect+counts.flagged+counts.unanswered+counts.unprocessed+counts.not_received).toBe(counts.total);
      expect(counts.usable).toBe(counts.correct+counts.incorrect);
      expect(counts.correctPercent).toBe(counts.correct/counts.usable*100);
    }
  });
  it('keeps wrong answers separate from contradictory correct values and partial work', () => {
    const state = createInitialState('teacher'); seedAssignment(state);
    const wrong = getAssignmentAnalytics(state,'baseline-template-v1',{ studentId:'stu-01' });
    expect(wrong.counts.incorrect).toBe(4);
    const response = state.responses[0];
    response.workingText='1/2=2/5; 5/6'; response.answerText='5/6'; response.legibility='clear';
    response.mathCheck=checkMath(getQuestion(response.questionId),response.workingText,response.answerText,response.legibility);
    expect(response.mathCheck.status).toBe('correct');
    expect(classifyResponse(state,response)).toMatchObject({ bucket:'flagged',numericResult:'correct',facets:{reasoning:'contradictory'} });
    response.workingText='1/2=3/6';response.answerText=null;
    expect(classifyResponse(state,response)).toMatchObject({bucket:'unanswered',facets:{partialWork:true}});
  });
  it('uses verification to resolve transcription uncertainty but retains actual contradictions', () => {
    const state=createInitialState('teacher');seedAssignment(state,'baseline-template-v1',{studentIds:['stu-04']});const response=state.responses[0];
    response.legibility='uncertain';response.mathCheck=checkMath(getQuestion(response.questionId),response.workingText,response.answerText,'uncertain');
    expect(classifyResponse(state,response).bucket).toBe('flagged');
    correctResponse(state,response.id,{expectedRevision:response.revision,workingText:response.workingText,answerText:response.answerText,legibility:'uncertain',readingStatus:'resolved',reason:'I verified the visible writing.'});
    expect(classifyResponse(state,response)).toMatchObject({bucket:'correct',teacherReviewed:true});
    correctResponse(state,response.id,{expectedRevision:response.revision,workingText:'1/2=2/5; 5/6',answerText:'5/6',legibility:'clear',readingStatus:'resolved',reason:'This contradiction is actually written.'});
    expect(classifyResponse(state,response)).toMatchObject({bucket:'correct',teacherReviewed:true,facets:{reasoning:'contradictory'}});
    expect(classifyResponse(state,response).reviewReasons).not.toEqual([]);
    correctResponse(state,response.id,{expectedRevision:response.revision,workingText:'1/2=2/5; 3/5',answerText:'3/5',legibility:'clear',readingStatus:'unreviewed',reason:'Reading awaiting verification.'});
    expect(classifyResponse(state,response)).toMatchObject({bucket:'flagged',numericResult:'incorrect'});
    correctResponse(state,response.id,{expectedRevision:response.revision,workingText:response.workingText,answerText:'3/5',legibility:'clear',readingStatus:'resolved',reason:'The wrong equality and final answer are literally written.'});
    expect(classifyResponse(state,response)).toMatchObject({bucket:'incorrect',teacherReviewed:true,facets:{reasoning:'contradictory'}});
  });
  it('keeps support and units independent from numerical correctness, with matching filtered slots', () => {
    const state=createInitialState('teacher');const batch=seedAssignment(state,'baseline-template-v1',{studentIds:['stu-04'],support:'supported'});
    let result=getAssignmentAnalytics(state,batch.templateId,{support:'supported',result:'correct'});
    expect(result.counts.correct).toBe(4);expect(result.slots.every(s=>s.supportLevel==='supported')).toBe(true);
    const response=state.responses.find(r=>r.questionId==='q-04')!;response.answerText='5/8';
    expect(classifyResponse(state,response)).toMatchObject({bucket:'correct',facets:{unitStatus:'missing'}});
    const submission=state.submissions[0];correctSupport(state,submission.id,{expectedRevision:submission.revision,support:{level:'unknown',source:'not-recorded',note:''},reason:'Conditions were not recorded.'});
    result=getAssignmentAnalytics(state,batch.templateId,{studentId:'stu-04',support:'unknown',result:'correct'});expect(result.counts.correct).toBe(4);
    expect(getAssignmentAnalytics(state,batch.templateId,{support:'supported'}).counts.total).toBe(0);
  });
  it('deduplicates later uploads without treating a new unprocessed attempt as an old correct answer', () => {
    const state=createInitialState('teacher');const old=seedAssignment(state,'baseline-template-v1',{studentIds:['stu-04']});
    const oldSubmission=state.submissions[0];const next=seedAssignment(state,'baseline-template-v1',{studentIds:['stu-04'],extract:false});
    const result=getAssignmentAnalytics(state,'baseline-template-v1',{studentId:'stu-04'});
    expect(result.counts).toMatchObject({total:4,unprocessed:4,correct:0});expect(result.totalAttempts).toBe(2);
    expect(selectEffectiveSubmissions(state,'baseline-template-v1')[0]).toMatchObject({batchId:next.id,supersedesSubmissionId:oldSubmission.id});
    expect(state.responses.filter(r=>state.submissions.find(s=>s.id===r.submissionId)?.batchId===old.id)).toHaveLength(4);
  });
  it('resolves exact historical revisions and does not rewrite a saved legacy math check', () => {
    const state=createInitialState('teacher');seedAssignment(state,'baseline-template-v1',{studentIds:['stu-04']});const response=state.responses[0];
    response.workingText='1/7=2/14; 5/6';response.mathCheck.equivalentReasoning=true;delete response.mathCheck.checkerVersion;
    const before=structuredClone(response);expect(classifyResponse(state,response).facets.reasoning).toBe('not_established');expect(response).toEqual(before);
    correctResponse(state,response.id,{expectedRevision:1,workingText:'1/2=3/6;1/3=2/6;3/6+2/6=5/6',answerText:'5/6',legibility:'clear',readingStatus:'resolved',reason:'Correct the recorded work.'});
    expect(selectResponseRevision(state,response.id,1)).toEqual(before);expect(selectResponseRevision(state,response.id,2)?.mathCheck.checkerVersion).toBe(2);
    expect(selectResponseRevision(state,response.id,999)).toBeUndefined();
  });
});

describe('dated teacher evidence selectors', () => {
  it('retains simultaneous current findings by objective and blocks carry-forward when newer work awaits review', () => {
    const state=createInitialState('teacher'),batch=seedAssignment(state,'baseline-template-v1',{studentIds:['stu-04']});
    const [finding]=analyzeBatch(state,{batchId:batch.id,provenance:testProvenance});
    const second=createFinding(state,{batchId:batch.id,studentId:finding.studentId,objectiveId:'obj-equivalent-fractions',code:finding.code,claimScope:finding.claimScope,explanation:'Equivalent fractions are shown.',evidence:finding.evidence,limitations:[],suggestedNextStep:'extension'});
    reviewFindings(state,{items:[finding,second].map(f=>({findingId:f.id,expectedRevision:f.revision,decision:'confirm'})),acknowledgeClearReadings:true});
    expect(getCurrentSkillFindings(state,{studentId:'stu-04'})).toHaveLength(2);
    seedAssignment(state,'followup-template-v1',{studentIds:['stu-04'],extract:false});
    expect(getCurrentSkillFindings(state,{studentId:'stu-04'})).toHaveLength(0);
    expect(getCurrentSkillFindings(state,{studentId:'stu-04',beforeDate:'2026-09-24'})).toHaveLength(2);
  });
  it('uses persisted activity dates defensively, rather than catalog order, for legacy states', () => {
    const state=createInitialState('teacher'),baseline=seedAssignment(state,'baseline-template-v1',{studentIds:['stu-04']}),followup=seedAssignment(state,'followup-template-v1',{studentIds:['stu-04']});
    baseline.activityDate='2026-09-28';followup.activityDate='2026-09-24';
    const findings=analyzeBatch(state,{batchId:baseline.id,provenance:testProvenance});
    reviewFindings(state,{items:findings.map(f=>({findingId:f.id,expectedRevision:f.revision,decision:'confirm'})),acknowledgeClearReadings:true});
    expect(getCurrentSkillFindings(state,{studentId:'stu-04'})[0]?.batchId).toBe(baseline.id);
    expect(getCurrentSkillFindings(state,{studentId:'stu-04',beforeDate:'2026-09-28'})).toEqual([]);
  });
  it('hides earlier analysis generations even when timestamps tie, and excludes replaced upload notes', () => {
    const state=createInitialState('teacher'),batch=seedAssignment(state,'baseline-template-v1',{studentIds:['stu-01']});
    analyzeBatch(state,{batchId:batch.id,provenance:testProvenance},{now:'2026-09-19T12:00:00Z'});
    analyzeBatch(state,{batchId:batch.id,provenance:testProvenance},{now:'2026-09-19T12:00:00Z'});
    expect(currentAssignmentFindings(state,batch.templateId)).toHaveLength(1);
    seedAssignment(state,batch.templateId,{studentIds:['stu-01'],extract:false});
    expect(currentAssignmentFindings(state,batch.templateId)).toHaveLength(0);
  });
  it('does not let legacy unrelated equivalence qualify a new independent claim', () => {
    const state=createInitialState('teacher'),batch=seedAssignment(state,'baseline-template-v1',{studentIds:['stu-04']});
    for(const response of state.responses){response.workingText=`1/7=2/14; ${response.answerText}`;response.mathCheck.equivalentReasoning=true;delete response.mathCheck.checkerVersion;}
    const finding=createFinding(state,{batchId:batch.id,studentId:'stu-04',objectiveId:'obj-add-unlike-fractions',code:'equivalent_fraction_reasoning',claimScope:'independent_performance',explanation:'Claimed independent working.',evidence:state.responses.map(r=>({responseId:r.id,responseRevision:r.revision})),limitations:[],suggestedNextStep:'extension'});
    expect(findingWarnings(state,finding,{acknowledgeClear:true})).not.toEqual([]);expect(state.responses.every(r=>r.mathCheck.equivalentReasoning)).toBe(true);
    const stored=JSON.stringify(state.responses);expect(getEffectiveResponse(state,state.responses[0]).mathCheck.equivalentReasoning).toBe(false);expect(JSON.stringify(state.responses)).toBe(stored);
    // A confirmation saved by the old checker remains visible as history but
    // cannot silently support a newly generated plan under the current rules.
    finding.status='confirmed';expect(getPlanningFindings(state,'2026-09-23')).toEqual([]);expect(finding.status).toBe('confirmed');
  });
});
