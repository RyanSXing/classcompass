import { z, ZodError } from 'zod';
import { randomUUID } from 'node:crypto';
import { createBatchSchema, candidateFindingSchema } from '@/lib/contracts';
import { curriculum } from '@/lib/curriculum';
import * as domain from '@/lib/domain';
import { DomainError } from '@/lib/domain/errors';
import { authenticate, supabaseClient, verifyOrigin } from '@/lib/server/auth';
import { configuration } from '@/lib/server/config';
import { repository } from '@/lib/server/repository';
import { boundedBytes, finalizeUpload, getObject, MAX_FILE, prepareUploads, putObject } from '@/lib/server/storage';
import { cancelJob, queueJob, retryJob, runNext } from '@/lib/server/jobs';
import { loadDemo, analyzeDemo, resetDemoState } from '@/lib/server/demo';
import { importLesson } from '@/lib/server/imports';
import { AIError } from '@/lib/server/ai';
import { askClassroomAssistant, clearAssistantConversation, generateClassroomBrief, getAssistantState, saveTeacherGoals } from '@/lib/server/assistant';

export const runtime = 'nodejs';
export const maxDuration = 120;
type Context = { params: Promise<{ path: string[] }> };
const ok = (data: unknown, status = 200) => Response.json({ data }, { status, headers: { 'Cache-Control': 'private, no-store' } });
async function body(request: Request) {
  const bytes = await boundedBytes(request, 128 * 1024);
  try { return bytes.length ? JSON.parse(bytes.toString()) : {}; }
  catch { throw new DomainError('INVALID_JSON', 400, 'Send a valid JSON request.'); }
}
function record<T extends { id: string }>(values: T[], id: string) {
  const found = values.find(value => value.id === id); if (!found) throw new DomainError('NOT_FOUND', 404, 'This record is unavailable.'); return found;
}
async function route(request: Request, context: Context) {
  try {
    verifyOrigin(request);
    const paths = (await context.params).path, [area, id, action] = paths;
    const method = request.method, config = configuration();
    if (area === 'auth' && method === 'POST' && paths.length === 2) {
      if (config.dataBackend === 'local') return ok({ local: true });
      const client = await supabaseClient();
      if (id === 'login') {
        const input = z.object({ email: z.email().max(254), password: z.string().min(1).max(200) }).strict().parse(await body(request));
        const { error } = await client.auth.signInWithPassword(input);
        if (error) throw new DomainError('LOGIN_FAILED', 401, 'The email or password was not accepted.');
        return ok({ signedIn: true });
      }
      if (id === 'logout') {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw new DomainError('LOGOUT_FAILED', 503, 'Could not end this browser session. Try again.');
        return ok({ signedOut: true });
      }
    }
    const actor = await authenticate(request), repo = repository(actor), key = request.headers.get('idempotency-key') || undefined;
    if (key && (key.length > 160 || !/^[\w.-]+$/.test(key))) throw new DomainError('INVALID_REQUEST_KEY', 400, 'Use a short request key containing letters, digits, dots or hyphens.');
    const ctx = { actorId: actor.id, idempotencyKey: key };
    if (area === 'classroom' && method === 'GET' && paths.length === 1) {
      const state = await repo.read();
      return ok({ state: { ...state, assistant: getAssistantState(state) }, config: { aiMode: config.aiMode, dataBackend: config.dataBackend, teacher: actor.name, aiProvider: config.aiProvider, assistantLiveAvailable: !!(config.aiProvider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.OPENROUTER_API_KEY)?.trim(), sampleToolsEnabled: config.sampleToolsEnabled }, curriculum });
    }
    if (area === 'assistant' && paths.length === 2) {
      if (id === 'chat' && method === 'POST') return ok(await askClassroomAssistant(repo, await body(request)));
      if (id === 'chat' && method === 'DELETE') return ok(await clearAssistantConversation(repo));
      if (id === 'brief' && method === 'POST') return ok(await generateClassroomBrief(repo, await body(request)));
      if (id === 'goals' && method === 'PATCH') return ok(await saveTeacherGoals(repo, await body(request)));
      if (id === 'context' && method === 'GET') return ok(getAssistantState(await repo.read()));
    }
    if (area === 'uploads') {
      if (id === 'prepare' && method === 'POST') return ok(await prepareUploads(actor, repo, await body(request), key), 201);
      if (action === 'complete' && method === 'POST') return ok(await finalizeUpload(actor, repo, id));
      if (action === 'content' && method === 'PUT') {
        if (config.dataBackend !== 'local') throw new DomainError('SIGNED_UPLOAD_REQUIRED', 403, 'Use the prepared private upload URL.');
        const asset = record((await repo.read()).assets, id);
        if (asset.status !== 'pending') throw new DomainError('UPLOAD_FINALIZED', 409, 'Original evidence is already finalized. Prepare a new upload.');
        const slot = new URL(request.url).searchParams.get('slot');
        if (!['original', 'normalized'].includes(slot || '')) throw new DomainError('UPLOAD_SLOT', 422, 'Select the prepared upload slot.');
        const bytes = await boundedBytes(request, MAX_FILE);
        await putObject(actor, slot === 'original' ? asset.originalObjectKey : asset.normalizedObjectKey!, bytes, request.headers.get('content-type') || asset.mimeType);
        return ok({ uploaded: true });
      }
    }
    if (area === 'assets' && id && method === 'GET') {
      const asset = record((await repo.read()).assets, id);
      if (asset.status !== 'ready') throw new DomainError('ASSET_NOT_READY', 409, 'Finish uploading this file first.');
      const normalized = new URL(request.url).searchParams.get('variant') !== 'original' && !!asset.normalizedSha256;
      const bytes = await getObject(actor, normalized ? asset.normalizedObjectKey! : asset.originalObjectKey);
      return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': normalized ? asset.normalizedMimeType! : asset.mimeType, 'Content-Length': String(bytes.length), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': `inline; filename="${asset.name.replace(/[^a-zA-Z0-9._-]/g, '_')}"` } });
    }
    if (area === 'demo' && method === 'POST') {
      if (!config.sampleToolsEnabled) throw new DomainError('SAMPLE_TOOLS_DISABLED', 403, 'Sample classroom tools are unavailable in this teacher workspace.');
      if (id === 'analyze') return ok(await analyzeDemo(actor, repo, await body(request)));
      if (id === 'load') return ok(await loadDemo(actor, repo, await body(request)), 201);
      if (id === 'reset') {
        if (config.dataBackend !== 'local' || config.aiMode !== 'fixture') throw new DomainError('RESET_DISABLED', 403, 'Demo reset is available only in local fixture mode.');
        z.object({ confirm: z.literal(true) }).strict().parse(await body(request));
        await repo.transact(state => resetDemoState(state, actor.id));
        return ok({ reset: true });
      }
    }
    if (area === 'lesson-imports' && method === 'POST') {
      const input = await body(request);
      if (!id) return ok(await importLesson(actor, repo, input), 201);
      if (action === 'confirm') return ok(await repo.transact(state => domain.confirmLessonImport(state, id, input, ctx)), 201);
    }
    if (area === 'batches') {
      if (!id && method === 'POST') {
        const input = createBatchSchema.parse(await body(request));
        return ok(await repo.transact(state => {
          const operation = 'batch.create', hash = JSON.stringify(input), prior = key && state.mutationKeys.find(k => k.operation === operation && k.key === key);
          if (prior) { if (prior.requestHash !== hash) throw new DomainError('IDEMPOTENCY_CONFLICT', 409, 'This key was already used for different inputs.'); return prior.result; }
          const batch = domain.createBatch(state, input, ctx);
          if (key) state.mutationKeys.push({ id: randomUUID(), ownerId: actor.id, createdAt: new Date().toISOString(), operation, key, requestHash: hash, result: batch });
          return batch;
        }), 201);
      }
      if (id && method === 'GET') {
        const state = await repo.read(), batch = record(state.batches, id), submissionIds = new Set(batch.submissionIds);
        return ok({ batch, submissions: state.submissions.filter(s => submissionIds.has(s.id)), responses: state.responses.filter(r => submissionIds.has(r.submissionId)), extractions: state.extractions.filter(e => submissionIds.has(e.submissionId)), findings: state.findings.filter(f => f.batchId === id), jobs: state.jobs.filter(j => j.batchId === id) });
      }
      if (action === 'analyze' && method === 'POST') { const input = await body(request); const job = await repo.transact(state => queueJob(state, 'analysis', id, input, key)); return ok({ jobId: job.id, job }, 202); }
    }
    if (area === 'jobs' && id) {
      if (method === 'GET') return ok(record((await repo.read()).jobs, id));
      if (method === 'POST' && action === 'run-next') return ok(await runNext(actor, repo, id));
      if (method === 'POST' && action === 'cancel') return ok(await repo.transact(state => cancelJob(state, id)));
      if (method === 'POST' && action === 'retry') return ok(await repo.transact(state => retryJob(state, id)));
    }
    if (area === 'responses' && id && method === 'PATCH') { const input = await body(request); return ok(await repo.transact(state => domain.correctResponse(state, id, input, ctx))); }
    if (area === 'submissions' && action === 'support' && method === 'PATCH') { const input = await body(request); return ok(await repo.transact(state => domain.correctSupport(state, id, input, ctx))); }
    if (area === 'findings') {
      const input = await body(request);
      if (id === 'review' && method === 'POST') return ok(await repo.transact(state => domain.reviewFindings(state, input, ctx)));
      if (!id && method === 'POST') { const draft = candidateFindingSchema.extend({ batchId: z.string() }).strict().parse(input); return ok(await repo.transact(state => domain.createFinding(state, draft, ctx)), 201); }
      if (id && method === 'PATCH') return ok(await repo.transact(state => domain.editFinding(state, id, input, ctx)));
    }
    if (area === 'plans' && action === 'proposals' && method === 'POST') { const input = await body(request); const job = await repo.transact(state => queueJob(state, 'proposal', id, input, key)); return ok({ jobId: job.id, job }, 202); }
    if (area === 'proposals' && id) {
      if (method === 'GET') { const state = await repo.read(), proposal = record(state.proposals, id); return ok({ proposal, before: record(state.planVersions, proposal.basePlanVersionId).snapshot, after: domain.proposalAfter(state, proposal), fresh: domain.proposalIsFresh(state, proposal) }); }
      const input = await body(request);
      if (method === 'PATCH') return ok(await repo.transact(state => domain.editProposal(state, id, input, ctx)));
      if (method === 'POST' && action === 'apply') return ok(await repo.transact(state => domain.applyProposal(state, id, input, ctx)), 201);
    }
    if (area === 'calendar' && method === 'GET') { const state = await repo.read(); return ok({ entries: state.calendarEntries, proposals: state.proposals.filter(p => domain.proposalIsFresh(state, p)) }); }
    if (area === 'students' && action === 'progress' && method === 'GET') { const state = await repo.read(); return ok({ student: record(state.students, id), observations: state.observations.filter(o => o.studentId === id), findings: state.findings.filter(f => f.studentId === id), responses: state.responses.filter(r => state.submissions.some(s => s.id === r.submissionId && s.studentId === id)) }); }
    if (area === 'materials' && id && method === 'GET') { const state = await repo.read(); return ok({ version: record(state.planVersions, id), materialSet: state.materialSets.find(m => m.planVersionId === id) || null }); }
    throw new DomainError('NOT_FOUND', 404, 'This endpoint is unavailable.');
  } catch (error) {
    if (error instanceof AIError) {
      console.warn('ClassCompass AI request failed', { code: error.code, retryable: error.retryable });
      return Response.json({ error: { code: error.code, message: error.message, retryable: error.retryable, ...(error.retryAfterMs ? { retryAfterSeconds: Math.ceil(error.retryAfterMs / 1000) } : {}) } }, { status: error.code === 'AI_RATE_LIMIT' ? 429 : 502, headers: { 'Cache-Control': 'private, no-store' } });
    }
    if (error instanceof ZodError) return Response.json({ error: { code: 'VALIDATION', message: 'Check the form fields and try again.', fieldErrors: z.flattenError(error).fieldErrors } }, { status: 422 });
    if (error instanceof DomainError) return Response.json({ error: { code: error.code, message: error.message, fieldErrors: error.fieldErrors } }, { status: error.status });
    console.error('ClassCompass request failed:', error instanceof Error ? error.name : 'UnknownError');
    return Response.json({ error: { code: 'SERVER_ERROR', message: 'This request could not finish. Your saved work is safe; refresh and retry.' } }, { status: 500 });
  }
}
export { route as DELETE, route as GET, route as POST, route as PATCH, route as PUT };
