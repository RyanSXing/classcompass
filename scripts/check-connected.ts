import { promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import type { AppState, Asset, Batch, Job, LessonImport, MaterialSet, PlanVersion, Proposal } from '../lib/contracts';

// Explicit connected integration check. Preserves the fictional teacher workspace;
// reruns resume its latest batches and accepted versions without resetting history.
const baseURL = new URL(process.env.CONNECTED_BASE_URL || 'http://127.0.0.1:3002');
const credentialsFile = process.env.CONNECTED_LOGIN_FILE || '.local/teacher-login.json';
const reportFile = '.local/connected-verification.json';
const cookies = new Map<string, string>();
const report = {
  startedAt: new Date().toISOString(), completedAt: '', status: 'running',
  backend: 'supabase', aiMode: 'fixture', liveModelCalls: 0,
  checks: [] as string[], counts: {} as Record<string, number>, resumed: false,
  preservedDemoWorkspace: true, failureCode: null as string | null,
};
let stage = 'configuration';
let signedIn = false;
let previewAssetId: string | undefined;
function check(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}
function pass(name: string) { report.checks.push(name); console.log(`PASS ${report.checks.length}: ${name}`); }
function absorbCookies(response: Response) {
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';', 1)[0], split = pair.indexOf('=');
    if (split < 1) continue;
    const name = pair.slice(0, split), value = pair.slice(split + 1);
    if (!value || /(?:^|;)\s*max-age=0(?:;|$)/i.test(header)) cookies.delete(name);
    else cookies.set(name, value);
  }
}
async function request(endpoint: string, options: { method?: string; body?: unknown; timeoutMs?: number; key?: string } = {}) {
  const headers = new Headers({ Origin: baseURL.origin });
  if (cookies.size) headers.set('Cookie', [...cookies].map(([name, value]) => `${name}=${value}`).join('; '));
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.key) headers.set('Idempotency-Key', options.key);
  const response = await fetch(new URL(endpoint, baseURL), {
    method: options.method || (options.body === undefined ? 'GET' : 'POST'), headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(options.timeoutMs || 20_000), redirect: 'error',
  });
  absorbCookies(response);
  return response;
}
async function api<T>(endpoint: string, options: Parameters<typeof request>[1] = {}): Promise<T> {
  const response = await request(endpoint, options);
  const envelope = await response.json() as { data?: T; error?: { code?: string } };
  if (!response.ok) throw new Error(`HTTP_${response.status}_${envelope.error?.code?.replace(/[^A-Z0-9_]/g, '') || 'REQUEST_FAILED'}`);
  check(envelope.data !== undefined, 'MISSING_DATA');
  return envelope.data;
}
async function state() {
  const result = await api<{ state: AppState; config: { dataBackend: string; aiMode: string } }>('/api/classroom');
  check(result.config.dataBackend === 'supabase' && result.config.aiMode === 'fixture', 'CONNECTED_FIXTURE_REQUIRED');
  return result.state;
}
async function runJob(id: string) {
  for (let step = 0; step < 20; step++) {
    const result = await api<{ job: Job }>(`/api/jobs/${id}/run-next`, { body: {} });
    if (result.job.status === 'completed') return result.job;
    check(!['failed', 'blocked', 'cancelled'].includes(result.job.status), `JOB_${result.job.errorCode || result.job.status.toUpperCase()}`);
    check(result.job.status !== 'waiting_retry', 'FIXTURE_JOB_UNEXPECTED_RETRY');
    if (result.job.steps.some(s => s.status === 'running')) await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('JOB_STEP_LIMIT');
}
async function analyze(batch: Batch) {
  const queued = await api<{ jobId: string }>(`/api/batches/${batch.id}/analyze`, { body: { expectedRevision: batch.revision }, key: randomUUID() });
  return runJob(queued.jobId);
}
async function batchFor(kind: 'baseline' | 'followup') {
  const current = await state(), existing = current.batches.filter(b => b.kind === kind).at(-1);
  if (existing) { report.resumed = true; return existing; }
  const loaded = await api<{ batchId: string }>('/api/demo/load', { body: { phase: kind }, timeoutMs: 120_000 });
  const refreshed = await state(), batch = refreshed.batches.find(b => b.id === loaded.batchId);
  check(batch, 'LOADED_BATCH_MISSING'); return batch;
}
async function confirmBatch(batch: Batch) {
  const current = await state();
  const candidates = current.findings.filter(f => f.batchId === batch.id && f.status === 'candidate');
  if (candidates.length) await api('/api/findings/review', { body: { items: candidates.map(f => ({ findingId: f.id, expectedRevision: f.revision, decision: 'confirm' })), acknowledgeClearReadings: true } });
  const confirmed = (await state()).findings.filter(f => f.batchId === batch.id && f.status === 'confirmed');
  check(new Set(confirmed.map(f => f.studentId)).size === 8, 'EIGHT_REVIEWED_STUDENTS_REQUIRED');
  return confirmed;
}
async function acceptLesson(lessonId: string) {
  const current = await state(), plan = current.plans.find(p => p.id === lessonId)!;
  const existing = current.planVersions.find(v => v.id === plan.currentVersionId)!;
  if (existing.proposalId) { report.resumed = true; return existing; }
  const queued = await api<{ jobId: string }>(`/api/plans/${lessonId}/proposals`, { body: { basePlanVersionId: plan.currentVersionId, expectedEvidenceRevision: current.classroom.evidenceRevision, expectedCalendarRevision: current.classroom.calendarRevision }, key: randomUUID() });
  const job = await runJob(queued.jobId);
  check(job.resultId, 'PROPOSAL_RESULT_MISSING');
  const { proposal } = await api<{ proposal: Proposal }>(`/api/proposals/${job.resultId}`);
  const body = { expectedRevision: proposal.revision, basePlanVersionId: proposal.basePlanVersionId, expectedEvidenceRevision: proposal.evidenceRevision, expectedCalendarRevision: proposal.calendarRevision, selectedChangeIds: proposal.changes.map(c => c.id) };
  const key = randomUUID();
  const applied = await api<{ planVersionId: string }>(`/api/proposals/${proposal.id}/apply`, { body, key });
  const repeat = await api<{ planVersionId: string }>(`/api/proposals/${proposal.id}/apply`, { body, key });
  check(repeat.planVersionId === applied.planVersionId, 'APPLY_NOT_IDEMPOTENT');
  const version = (await state()).planVersions.find(v => v.id === applied.planVersionId);
  check(version, 'ACCEPTED_VERSION_MISSING'); return version;
}
function verifyLanes(version: PlanVersion, targeted: string[]) {
  check(version.snapshot.blocks.reduce((sum, block) => sum + block.minutes, 0) === 45, 'LESSON_MINUTES');
  const practice = version.snapshot.blocks.find(b => b.id === 'practice')!;
  check(practice.minutes === 12 && practice.lanes?.length === 3, 'CONCURRENT_PRACTICE');
  check(new Set(practice.lanes.flatMap(l => l.studentIds)).size === 8 && practice.lanes.flatMap(l => l.studentIds).length === 8, 'ROSTER_COVERAGE');
  check(JSON.stringify(practice.lanes.find(l => l.id === 'targeted')!.studentIds.slice().sort()) === JSON.stringify(targeted), 'TARGETED_MEMBERSHIP');
}
async function verifyPDFImport(projectURL: string) {
  const bytes = await fs.readFile('public/demo/lesson-2026-09-23-original.pdf');
  const prepared = await api<{ assets: { id: string; method: string; uploadUrl: string; headers: Record<string, string> }[] }>('/api/uploads/prepare', { body: { purpose: 'lesson', files: [{ name: 'lesson-2026-09-23-original.pdf', type: 'application/pdf', size: bytes.length }] }, key: randomUUID() });
  const asset = prepared.assets[0], uploadURL = new URL(asset.uploadUrl);
  check(uploadURL.origin === new URL(projectURL).origin && uploadURL.protocol === 'https:' && uploadURL.pathname.startsWith('/storage/v1/object/upload/sign/classcompass-evidence/'), 'UNEXPECTED_SIGNED_UPLOAD_TARGET');
  const uploaded = await fetch(uploadURL, { method: asset.method, headers: { ...asset.headers, 'Content-Type': 'application/pdf' }, body: new Uint8Array(bytes), signal: AbortSignal.timeout(20_000), redirect: 'error' });
  check(uploaded.ok, `SIGNED_UPLOAD_HTTP_${uploaded.status}`);
  const ready = await api<Asset>(`/api/uploads/${asset.id}/complete`, { body: {} });
  check(ready.status === 'ready' && ready.sha256 === createHash('sha256').update(bytes).digest('hex'), 'PDF_FINALIZATION');
  const imported = await api<LessonImport>('/api/lesson-imports', { body: { assetId: asset.id } });
  check(imported.draft?.blocks.length === 5 && imported.errors.length === 0, 'PDF_IMPORT_PREVIEW');
  const current = await state(), plan = current.plans.find(p => p.id === 'lesson-2026-09-23')!;
  const version = current.planVersions.find(v => v.id === plan.currentVersionId)!;
  if (!version.proposalId) await api(`/api/lesson-imports/${imported.id}/confirm`, { body: { expectedRevision: imported.revision, lesson: imported.draft, expectedPlanVersionId: plan.currentVersionId } });
  const preview = await request(`/api/assets/${asset.id}?variant=original`);
  check(preview.ok && preview.headers.get('content-type') === 'application/pdf', 'PRIVATE_PDF_PREVIEW');
  check(Buffer.from(await preview.arrayBuffer()).equals(bytes), 'PRIVATE_PDF_BYTES');
  previewAssetId = asset.id;
  pass('Private signed PDF upload, verification, source preview and lesson import');
}
async function main() {
  check(['127.0.0.1', 'localhost', '[::1]'].includes(baseURL.hostname), 'LOOPBACK_SERVER_REQUIRED');
  const login = JSON.parse(await fs.readFile(credentialsFile, 'utf8')) as { email: string; password: string; projectURL: string };
  check(login.email && login.password && login.projectURL, 'LOGIN_CONFIGURATION_REQUIRED');
  stage = 'login';
  check((await request('/api/classroom')).status === 401, 'ANONYMOUS_CLASSROOM_ACCESS');
  await api('/api/auth/login', { body: { email: login.email, password: login.password } }); signedIn = true;
  check(cookies.size > 0, 'SESSION_COOKIE_MISSING'); await state();
  pass('Anonymous denial and real teacher cookie authentication');
  stage = 'lesson-import'; await verifyPDFImport(login.projectURL);
  stage = 'baseline'; const baseline = await batchFor('baseline');
  let current = await state();
  if (current.responses.filter(r => baseline.submissionIds.includes(r.submissionId)).length < 32) await analyze(baseline);
  current = await state();
  check(current.responses.filter(r => baseline.submissionIds.includes(r.submissionId)).length === 32, 'BASELINE_RESPONSE_COUNT');
  const baselineAsset = current.assets.find(a => a.id === current.submissions.find(s => s.id === baseline.submissionIds[0])!.assetId)!;
  const preview = await request(`/api/assets/${baselineAsset.id}?variant=original`);
  check(preview.ok && createHash('sha256').update(Buffer.from(await preview.arrayBuffer())).digest('hex') === baselineAsset.sha256, 'PRIVATE_WORKSHEET_PREVIEW');
  pass('Eight private baseline scans extracted into 32 source-linked responses');
  stage = 'corrections';
  const finleySubmission = current.submissions.find(s => s.batchId === baseline.id && s.studentId === 'stu-06')!;
  const finley = current.responses.find(r => r.submissionId === finleySubmission.id && r.questionId === 'q-03')!;
  if (finley.answerText !== '1/2' || finley.legibility !== 'clear') await api(`/api/responses/${finley.id}`, { method: 'PATCH', body: { expectedRevision: finley.revision, workingText: '2/5 = 4/10; 4/10 + 1/10 = 5/10 = 1/2', answerText: '1/2', legibility: 'clear', readingStatus: 'resolved', reason: 'Connected demo verification: the source denominator is 2 and the previous result is 5/10.' } });
  const gray = current.submissions.find(s => s.batchId === baseline.id && s.studentId === 'stu-07')!;
  if (gray.support.level !== 'supported') await api(`/api/submissions/${gray.id}/support`, { method: 'PATCH', body: { expectedRevision: gray.revision, support: { level: 'supported', source: 'teacher-corrected', note: 'Fictional teacher prompted Gray to find a common denominator on each baseline question.' }, reason: 'Record the assistance that was provided.' } });
  current = await state();
  const effective = current.responses.find(r => r.id === finley.id)!;
  check(effective.mathCheck.status === 'correct' && effective.uncertaintyNote === null && !effective.alternatives.length, 'FINLEY_EFFECTIVE_CORRECTION');
  check(current.extractions.find(e => e.id === effective.extractionId)!.raw.responses.find(r => r.questionId === 'q-03')!.answerText === '1/5', 'ORIGINAL_EXTRACTION_PRESERVED');
  check(current.responses.filter(r => r.submissionId === gray.id).every(r => r.mathCheck.status === 'correct'), 'GRAY_CORRECTNESS_PRESERVED');
  await analyze(baseline); await confirmBatch(baseline);
  pass('Finley reading and Gray support corrections persisted; eight students reviewed');
  stage = 'baseline-plan'; const firstVersion = await acceptLesson('lesson-2026-09-23'); verifyLanes(firstVersion, ['stu-01', 'stu-02', 'stu-03']);
  const preservedSeptember23 = JSON.stringify(firstVersion);
  const materials = await api<{ materialSet: MaterialSet | null }>(`/api/materials/${firstVersion.id}`);
  check(materials.materialSet?.materials.some(m => m.id === 'targeted-equal-parts-v1'), 'ACCEPTED_TARGETED_MATERIAL');
  const calendar = await api<{ entries: AppState['calendarEntries'] }>('/api/calendar');
  check(calendar.entries.find(e => e.id === 'calendar-2026-09-24')?.checkpoint?.minutes === 8, 'ACCEPTED_CHECKPOINT');
  check(calendar.entries.some(e => e.date === '2026-10-02' && e.locked), 'FIXED_ASSESSMENT');
  check(calendar.entries.some(e => e.date === '2026-10-05' && e.preview), 'NEXT_UNIT_PRESERVED');
  pass('September 23 accepted once with all students, materials and fixed calendar constraints');
  stage = 'followup'; const followup = await batchFor('followup'); await analyze(followup); await confirmBatch(followup);
  current = await state();
  check(current.responses.filter(r => followup.submissionIds.includes(r.submissionId)).length === 16, 'FOLLOWUP_RESPONSE_COUNT');
  const blake = current.submissions.find(s => s.batchId === followup.id && s.studentId === 'stu-02')!;
  check(current.responses.some(r => r.submissionId === blake.id && r.answerText === '3/6 meter' && r.mathCheck.status === 'correct'), 'UNREDUCED_FRACTION_CREDIT');
  const harper = current.findings.filter(f => f.batchId === followup.id && f.studentId === 'stu-08' && f.status === 'confirmed');
  check(harper.some(f => f.observationStatus === 'independent') && harper.some(f => f.observationStatus === 'insufficient'), 'HARPER_DISTINCT_EVIDENCE');
  pass('Sixteen fresh responses reviewed, including unreduced credit and incomplete evidence');
  stage = 'followup-plan'; const nextVersion = await acceptLesson('lesson-2026-09-25'); verifyLanes(nextVersion, ['stu-03']);
  current = await state();
  check(JSON.stringify(current.planVersions.find(v => v.id === firstVersion.id)) === preservedSeptember23, 'TAUGHT_LESSON_CHANGED');
  const grayProgress = await api<{ observations: AppState['observations'] }>('/api/students/stu-07/progress');
  check(grayProgress.observations.some(o => !o.superseded && o.observationStatus === 'supported') && grayProgress.observations.some(o => !o.superseded && o.observationStatus === 'independent'), 'GRAY_DATED_HISTORY');
  report.counts = { baselineResponses: 32, followupResponses: 16, baselineStudents: 8, followupStudents: 8, acceptedLessons: 2, checks: report.checks.length + 2 };
  pass('September 25 accepted; taught September 23 and dated progress history preserved');
  stage = 'logout'; await api('/api/auth/logout', { body: {} }); signedIn = false;
  check((await request('/api/classroom')).status === 401, 'LOGOUT_SESSION_REMAINS');
  check((await request(`/api/assets/${previewAssetId}`)).status === 401, 'LOGOUT_PRIVATE_ASSET_ACCESS');
  pass('Logout denies classroom and private evidence access');
  report.status = 'passed';
}
main().catch(error => {
  report.status = 'failed';
  const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'REQUEST_OR_VERIFICATION_FAILED';
  report.failureCode = `${stage}:${code}`;
  console.error(`Connected verification failed at ${stage}: ${code}`); process.exitCode = 1;
}).finally(async () => {
  if (signedIn) { try { await api('/api/auth/logout', { body: {} }); } catch { /* Cookies are process-local and never saved. */ } }
  cookies.clear(); report.completedAt = new Date().toISOString(); report.counts.checks = report.checks.length;
  await fs.mkdir(path.dirname(reportFile), { recursive: true });
  await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(`Connected verification ${report.status}: ${report.checks.length} checks. Report: ${reportFile}`);
});
