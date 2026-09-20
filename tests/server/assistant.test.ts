import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AppState } from '@/lib/contracts';
import { assignments } from '@/lib/assignments';
import { createInitialState, analyzeBatch, correctResponse, reviewFindings } from '@/lib/domain';
import { askClassroomAssistant, buildAssistantContext, buildAssistantModelContext, generateClassroomBrief, getAssistantState, saveTeacherGoals } from '@/lib/server/assistant';
import { resetDemoState } from '@/lib/server/demo';
import { LocalRepository, type Repository } from '@/lib/server/repository';
import { seedAssignment, testProvenance } from '../domain/helpers';

class MemoryRepository implements Repository {
  constructor(public state: AppState = createInitialState('teacher')) {}
  async read() { return structuredClone(this.state); }
  async transact<T>(operation: (state: AppState) => T): Promise<T> { const next = structuredClone(this.state); const result = operation(next); next.revision++; this.state = next; return result; }
}
const domainState = (state: AppState) => Object.fromEntries(Object.entries(state).filter(([key]) => !['assistant', 'revision'].includes(key)));
function seeded() { const state = createInitialState('teacher'); for (const assignment of assignments) { const batch = seedAssignment(state, assignment.templateId); analyzeBatch(state, { batchId: batch.id, provenance: testProvenance }); } return new MemoryRepository(state); }
function rawReply(sourceId: string) { return { answer: 'Review this current answer before planning a short equal-parts example. No change has been applied.', sourceIds: [sourceId], actions: [{ title: 'Inspect the response', description: 'Compare the original writing and recorded assistance.', sourceId }] }; }
function response(body: unknown) { return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(body) } }] }), { status: 200 }); }
function mockedProvider(repo: MemoryRepository) { const id = buildAssistantContext(repo.state).sources.find(s => s.kind === 'response')!.id; const fetcher = vi.fn().mockResolvedValue(response(rawReply(id))); vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test-private-api-key'); vi.stubEnv('AI_MODE', 'fixture'); return fetcher; }
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('authoritative assistant context', () => {
  it('includes all five effective assignments, expected answers, saved teacher edits, guides, help and constraints but no raw extraction or secrets', () => {
    const repo = seeded(), state = repo.state;
    state.extractions[0].raw.responses[0].workingText = 'PRIVATE_RAW_EXTRACTION';
    state.assets[0].originalObjectKey = 'PRIVATE_STORAGE_KEY';
    state.planVersions[0].snapshot.blocks[0].instructions = 'Teacher edited opening: compare two equal ribbon wholes.';
    const context = buildAssistantContext(state, { studentId: 'stu-03', templateId: assignments[4].templateId });
    expect(context.classroom.assignments).toHaveLength(5);
    expect(context.disclosure.responseCount).toBe(120);
    expect(context.classroom.assignments.flatMap(a => a.responses)).toHaveLength(120);
    expect(context.classroom.assignments[0].questions[0].expectedAnswer).toBeDefined();
    expect(context.classroom.assignments[0].responses[0].support.level).toBe('independent');
    expect(context.classroom.plans[0].teacherGuide.sequence[0].savedInstructions).toContain('Teacher edited');
    expect(context.classroom.calendar.some(e => e.locked && e.date === '2026-10-02')).toBe(true);
    expect(context.classroom.goals.isSet).toBe(false);
    const serialized = JSON.stringify(context);
    for (const secret of ['PRIVATE_RAW_EXTRACTION', 'PRIVATE_STORAGE_KEY', 'groundTruth', 'originalObjectKey', 'ownerId']) expect(serialized).not.toContain(secret);
    const first = context.sources.find(s => s.kind === 'response')!;
    expect(first.href).toContain('revision=1'); expect(first.href).toContain('response='); expect(first.label).toContain('2026-09-22');
  });
  it('deduplicates replacement uploads and distinguishes historical notes with a visible conversation limit', async () => {
    const repo = seeded(); const prior = repo.state.findings[0];
    seedAssignment(repo.state, assignments[0].templateId, { studentIds: [prior.studentId] });
    for (let i = 0; i < 8; i++) await askClassroomAssistant(repo, { requestId: `chat-${i}`, message: i ? 'What should I do next?' : 'How is Avery doing?', mode: 'fixture' });
    const context = buildAssistantContext(repo.state);
    expect(context.classroom.assignments[0].responses).toHaveLength(32);
    expect(context.classroom.assignments[0].totalAttempts).toBe(9);
    expect(context.classroom.historicalNotes.some(f => f.id === prior.id && f.historical)).toBe(true);
    expect(context.history).toHaveLength(12); expect(context.disclosure.conversationTurnsOmitted).toBe(4);
    expect(context.disclosure.text).toContain('latest 12 conversation turns');
  });
  it('uses the newly corrected effective response and maintains exact citation revision', () => {
    const repo = seeded(), old = repo.state.responses[0];
    correctResponse(repo.state, old.id, { expectedRevision: old.revision, workingText: '1/2 = 3/6; 1/3 = 2/6; 3/6 + 2/6 = 5/6', answerText: '5/6', legibility: 'clear', readingStatus: 'resolved', reason: 'Literal source checked.' });
    const context = buildAssistantContext(repo.state), current = context.classroom.assignments[0].responses.find(r => r.responseId === old.id)!;
    expect(current.responseRevision).toBe(2); expect(current.answerText).toBe('5/6'); expect(current.result).toBe('correct');
    expect(context.sources.find(s => s.id === current.sourceId)!.href).toContain('revision=2');
    expect(repo.state.responseRevisions[0].before.answerText).toBe('2/5');
  });
});

describe('persistent teacher-controlled assistant', () => {
  it('persists goals, dialogue and briefs locally, preserving classroom data and old briefs on goal changes', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'classcompass-assistant-'));
    try {
      const repo = new LocalRepository(dir, 'teacher'); const initial = await repo.read(); const before = domainState(initial);
      expect(getAssistantState(initial).goals.text).toBe('');
      const goals = await saveTeacherGoals(repo, { text: 'Ask for reasoning before adding more practice.', expectedRevision: 0 });
      expect(goals.revision).toBe(1);
      const brief = await generateClassroomBrief(repo, { requestId: 'brief-1', scope: { templateId: assignments[0].templateId }, mode: 'fixture' });
      expect(brief.brief.stale).toBeUndefined(); expect(brief.brief.content).toContain(goals.text);
      const chat = await askClassroomAssistant(repo, { message: 'What should I teach next?', requestId: 'chat-1', mode: 'fixture' });
      expect(chat.turn.provenance?.mode).toBe('fixture'); expect(chat.turn.content).toContain('no live model');
      expect(getAssistantState(await repo.read()).brief?.stale).toBe(false);
      await saveTeacherGoals(repo, { text: 'Prioritize independent explanations.', expectedRevision: 1 });
      const reloaded = await new LocalRepository(dir, 'teacher').read(), assistant = getAssistantState(reloaded);
      expect(assistant.turns).toHaveLength(2); expect(assistant.briefs).toHaveLength(1); expect(assistant.brief?.stale).toBe(true); expect(assistant.briefs[0].stale).toBe(true);
      expect(domainState(reloaded)).toEqual(before);
      await expect(saveTeacherGoals(repo, { text: 'Stale replacement', expectedRevision: 1 })).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
      await expect(new LocalRepository(dir, 'other-teacher').read()).rejects.toMatchObject({ code: 'STORE_VERSION' });
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('responds to selected student/lesson and persists useful follow-up context in sample mode without a provider', async () => {
    const repo = seeded(), fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const first = await askClassroomAssistant(repo, { message: 'How is Casey doing?', scope: { studentId: 'stu-03', lessonId: assignments[4].targetLessonId }, requestId: 'first', mode: 'fixture' });
    expect(first.turn.content).toContain('Casey'); expect(first.turn.content).toContain('Independent check');
    const follow = await askClassroomAssistant(repo, { message: 'Why that next activity?', scope: { studentId: 'stu-03' }, requestId: 'follow', mode: 'fixture' });
    expect(follow.turn.content).toContain('Building on the saved conversation'); expect(follow.turn.contextDisclosure?.conversationTurnsIncluded).toBe(2); expect(fetcher).not.toHaveBeenCalled();
  });
  it('allows explicit free live mode in a fixture workspace, validates links and persists a request only once', async () => {
    const repo = seeded(), before = domainState(repo.state), fetcher = mockedProvider(repo);
    const request = { message: 'Give me one next step.', requestId: 'live-one', mode: 'live' as const };
    const answer = await askClassroomAssistant(repo, request), duplicate = await askClassroomAssistant(repo, request);
    expect(answer.turn.provenance?.mode).toBe('live'); expect(duplicate.reused).toBe(true); expect(duplicate.turn.id).toBe(answer.turn.id); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(repo.state.assistant?.turns).toHaveLength(2); expect(domainState(repo.state)).toEqual(before);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.model).toMatch(/:free$/); expect(body.reasoning).toEqual({ enabled: false }); expect(body.response_format.type).toBe('json_schema');
    const sent = JSON.parse(body.messages[1].content);
    expect(sent.context.classroom.assignments).toHaveLength(5); expect(sent.message).toBe(request.message);
    expect(answer.turn.actions[0].href).toEqual(answer.turn.citations[0].href);
    await expect(askClassroomAssistant(repo, { ...request, message: 'Changed question' })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
  });
  it('rejects an in-flight duplicate and discards stale completion after a goal edit without blocking the edit', async () => {
    const repo = seeded(); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    let finish!: (value: Response) => void, started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const fetcher = vi.fn().mockImplementation(() => { started(); return new Promise<Response>(resolve => { finish = resolve; }); }); vi.stubGlobal('fetch', fetcher);
    const request = { message: 'What next?', requestId: 'pending', mode: 'live' as const }, running = askClassroomAssistant(repo, request);
    await ready;
    await expect(askClassroomAssistant(repo, request)).rejects.toMatchObject({ code: 'ASSISTANT_PENDING' });
    await saveTeacherGoals(repo, { text: 'A newly saved priority.' });
    finish(response(rawReply(buildAssistantContext(repo.state).sources.find(s => s.kind === 'response')!.id)));
    await expect(running).rejects.toMatchObject({ code: 'ASSISTANT_STALE' });
    expect(repo.state.assistant?.turns.filter(t => t.role === 'assistant')).toHaveLength(0);
    expect(repo.state.assistant?.requests[0].errorCode).toBe('ASSISTANT_STALE'); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('ignores chat-only revision changes during completion, while rejecting actual response corrections', async () => {
    const repo = seeded(); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    let finish!: (value: Response) => void, started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => { started(); return new Promise<Response>(resolve => { finish = resolve; }); }));
    const running = askClassroomAssistant(repo, { requestId: 'live', message: 'What next?', mode: 'live' }); await ready;
    await askClassroomAssistant(repo, { requestId: 'sample', message: 'How is Casey doing?', mode: 'fixture' });
    finish(response(rawReply(buildAssistantContext(repo.state).sources.find(s => s.kind === 'response')!.id)));
    await expect(running).resolves.toMatchObject({ turn: { provenance: { mode: 'live' } } });
    const before = buildAssistantContext(repo.state).fingerprint;
    repo.state.responses[0].answerText = '5/6';
    expect(buildAssistantContext(repo.state).fingerprint).not.toBe(before);
  });
  it.each(['unknown-source', 'unsafe-link', 'invalid-shape'])('rejects %s output and retains only the user attempt', async failure => {
    const repo = seeded(), before = domainState(repo.state), id = buildAssistantContext(repo.state).sources[0].id;
    vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const body = failure === 'unknown-source' ? rawReply('response:invented:1') : failure === 'unsafe-link' ? { ...rawReply(id), answer: 'Visit https://example.com to upload work.' } : { answer: 'Missing sources' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body)));
    await expect(askClassroomAssistant(repo, { requestId: failure, message: 'Help', mode: 'live' })).rejects.toMatchObject({ code: failure === 'unknown-source' ? 'AI_UNGROUNDED_CITATION' : failure === 'unsafe-link' ? 'AI_UNSAFE_LINK' : 'AI_INVALID_OUTPUT' });
    expect(repo.state.assistant?.turns).toHaveLength(1); expect(repo.state.assistant?.requests[0].status).toBe('failed'); expect(domainState(repo.state)).toEqual(before);
  });
  it('reclaims an identical failed request without duplicating the user message', async () => {
    const repo = seeded(), id = buildAssistantContext(repo.state).sources.find(s => s.kind === 'response')!.id;
    vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Busy' } }), { status: 429 })).mockResolvedValueOnce(response(rawReply(id))); vi.stubGlobal('fetch', fetcher);
    const input = { requestId: 'retry-same-id', message: 'What next?', mode: 'live' as const };
    await expect(askClassroomAssistant(repo, input)).rejects.toMatchObject({ code: 'AI_RATE_LIMIT' });
    const firstAttempt = repo.state.assistant!.requests[0].attemptId;
    const result = await askClassroomAssistant(repo, input);
    expect(result.turn.role).toBe('assistant'); expect(repo.state.assistant!.turns).toHaveLength(2); expect(repo.state.assistant!.requests).toHaveLength(1);
    expect(repo.state.assistant!.requests[0].attemptId).not.toBe(firstAttempt); expect(fetcher).toHaveBeenCalledTimes(2);
    const sent = JSON.parse(JSON.parse(fetcher.mock.calls[1][1].body).messages[1].content); expect(sent.context.conversation).toEqual([]);
  });
  it('produces concrete sample teaching steps, scoped lesson timing and distinct comparison guidance', async () => {
    const repo = seeded();
    const brief = await generateClassroomBrief(repo, { requestId: 'brief-specific', scope: { templateId: assignments[0].templateId }, mode: 'fixture' });
    expect(brief.brief.content).toContain('Success check:'); expect(brief.brief.content).toContain('equal-length fraction strips'); expect(brief.brief.content).toContain('Avery');
    const lesson = await askClassroomAssistant(repo, { requestId: 'old-lesson', message: 'Help me teach this lesson', scope: { lessonId: 'lesson-2026-09-23' }, mode: 'fixture' });
    expect(lesson.turn.content).toContain('First check (2026-09-22)'); expect(lesson.turn.content).not.toContain('Independent check'); expect(lesson.turn.content).toContain('Worked example:');
    const compare = await askClassroomAssistant(repo, { requestId: 'compare', message: 'Compare Casey’s progress', mode: 'fixture' });
    expect(compare.turn.content).toContain('Casey:'); expect(compare.turn.content).toContain('not a standardized growth score');
  });
  it('rejects a Casey claim supported only by Avery’s work or a roster citation', async () => {
    const repo = seeded(), context = buildAssistantContext(repo.state), avery = context.classroom.assignments[0].responses.find(r => r.studentId === 'stu-01')!;
    vi.stubEnv('OPENROUTER_API_KEY', 'test');
    for (const [index, id] of [avery.sourceId!, 'student:stu-03'].entries()) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ answer: 'Casey independently solved every First check answer correctly and is ready for extension.', sourceIds: [id], actions: [] })));
      await expect(askClassroomAssistant(repo, { requestId: `wrong-student-${index}`, message: 'How is Casey doing?', scope: { studentId: 'stu-03' }, mode: 'live' })).rejects.toMatchObject({ code: 'AI_WRONG_STUDENT_SOURCE' });
    }
    expect(repo.state.assistant!.turns.filter(t => t.role === 'assistant')).toHaveLength(0);
  });
  it('marks older lessons as ineligible after later reviewed work and preserves historical plan citations', () => {
    const repo = seeded();
    const finding = repo.state.findings.find(f => f.studentId === 'stu-01' && repo.state.batches.find(b => b.id === f.batchId)!.templateId === assignments[4].templateId)!;
    reviewFindings(repo.state, { items: [{ findingId: finding.id, expectedRevision: finding.revision, decision: 'confirm' }], acknowledgeClearReadings: true });
    const old = repo.state.planVersions[0], replacement = { ...structuredClone(old), id: 'edited-version', versionNumber: 2, previousVersionId: old.id };
    repo.state.planVersions.push(replacement); repo.state.plans[0].currentVersionId = replacement.id;
    const context = buildAssistantContext(repo.state);
    expect(context.classroom.plans[0].planningStatus).toBe('historical_lesson_after_later_review'); expect(context.classroom.plans[0].planningEligibleFindingIds).toEqual([]);
    const historical = context.classroom.historicalPlans.find(p => p.id === old.id)!;
    expect(context.sources.find(s => s.id === historical.sourceId)!.href).toContain(`version=${old.id}`);
    const compact = buildAssistantModelContext(context);
    expect(compact.classroom.assignments.reduce((count, a) => count + a.responses.length, 0)).toBe(120);
    expect(compact.classroom.plans[0].snapshot.blocks[0].instructions).toBe(replacement.snapshot.blocks[0].instructions);
    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(context).length * .6);
  });
  it('never falls back from a failed free provider or allows a paid endpoint', async () => {
    const repo = seeded(), fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'private provider diagnostic' } }), { status: 429 }));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    await expect(askClassroomAssistant(repo, { requestId: 'limited', message: 'Help', mode: 'live' })).rejects.toMatchObject({ code: 'AI_RATE_LIMIT' });
    expect(fetcher).toHaveBeenCalledTimes(1); expect(repo.state.assistant?.turns).toHaveLength(1);
    vi.stubEnv('OPENROUTER_REASONING_MODEL', 'paid/model');
    await expect(askClassroomAssistant(repo, { requestId: 'paid', message: 'Help', mode: 'live' })).rejects.toMatchObject({ code: 'AI_MODEL_COST' }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('clears additive assistant state on explicit reset and discards an in-flight reply', async () => {
    const repo = seeded(); await saveTeacherGoals(repo, { text: 'A saved goal.' });
    await askClassroomAssistant(repo, { requestId: 'before-reset', message: 'Help', mode: 'fixture' });
    repo.state.lastDispatchAt = new Date().toISOString();
    vi.stubEnv('OPENROUTER_API_KEY', 'test'); let finish!: (value: Response) => void, started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; }), id = buildAssistantContext(repo.state).sources[0].id;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => { started(); return new Promise<Response>(resolve => { finish = resolve; }); }));
    const running = askClassroomAssistant(repo, { requestId: 'during-reset', message: 'Help', mode: 'live' }); await ready;
    await repo.transact(state => resetDemoState(state, state.ownerId));
    expect(repo.state.assistant).toBeUndefined(); expect(repo.state.lastDispatchAt).toBeUndefined(); expect(repo.state.responses).toEqual([]);
    finish(response(rawReply(id))); await expect(running).rejects.toMatchObject({ code: 'ASSISTANT_STALE' });
    expect(getAssistantState(repo.state).goals.text).toBe(''); expect(getAssistantState(repo.state).turns).toEqual([]);
  });
  it('validates scope and bounded input before any provider call', async () => {
    const repo = seeded(), fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    for (const scope of [{ studentId: 'other-class-student' }, { templateId: 'invented' }, { lessonId: 'other-class-lesson' }]) await expect(askClassroomAssistant(repo, { requestId: 'bad', message: 'Help', scope, mode: 'live' })).rejects.toMatchObject({ code: 'ASSISTANT_SCOPE' });
    await expect(askClassroomAssistant(repo, { requestId: 'long', message: 'a'.repeat(4001), mode: 'live' })).rejects.toMatchObject({ code: 'ASSISTANT_INPUT' });
    expect(fetcher).not.toHaveBeenCalled(); expect(repo.state.assistant).toBeUndefined();
  });
});
