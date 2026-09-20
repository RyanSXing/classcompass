import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AppState } from '@/lib/contracts';
import { assignments } from '@/lib/assignments';
import { createInitialState, analyzeBatch, correctResponse, reviewFindings } from '@/lib/domain';
import { askClassroomAssistant, buildAssistantContext, buildAssistantModelContext, clearAssistantConversation, generateClassroomBrief, getAssistantState, saveTeacherGoals } from '@/lib/server/assistant';
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
function briefResponse(body: object) { return response({ comparisons: [], ...body }); }
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
  it('clears only chat history and prevents a pending reply from returning after reset', async () => {
    const repo = seeded(), before = domainState(repo.state);
    const savedBrief = await generateClassroomBrief(repo, { requestId: 'clear-keeps-brief', mode: 'fixture' });
    const sourceId = buildAssistantContext(repo.state).sources.find(source => source.kind === 'response')!.id;
    let resolveReply: (value: Response) => void = () => {};
    const fetcher = vi.fn(() => new Promise<Response>(resolve => { resolveReply = resolve; }));
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const pending = askClassroomAssistant(repo, { requestId: 'clear-pending-chat', message: 'What should I teach next?', mode: 'live' });
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());

    const cleared = await clearAssistantConversation(repo);
    expect(cleared.turns).toEqual([]);
    expect(cleared.requests.filter(request => request.kind === 'chat')).toEqual([]);
    expect(cleared.goals).toEqual({ text: '', revision: 0, updatedAt: null });
    expect(cleared.briefs).toHaveLength(1);
    expect(cleared.brief?.id).toBe(savedBrief.brief.id);

    resolveReply(response(rawReply(sourceId)));
    await expect(pending).rejects.toMatchObject({ code: 'ASSISTANT_STALE' });
    expect(getAssistantState(repo.state).turns).toEqual([]);
    expect(domainState(repo.state)).toEqual(before);
  });
  it('answers roster questions directly in sample mode without a teaching lecture or model call', async () => {
    const repo = seeded(), fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    for (const [index, message] of ['who are my students', 'name my students', 'Which students are in my class?', 'How many students do I have?', 'Show my class list', 'Who is in my class?'].entries()) {
      const answer = await askClassroomAssistant(repo, { requestId: `roster-${index}`, message, mode: 'fixture' });
      expect(answer.turn.content).toBe('Your 8 students are:\n\nAvery, Blake, Casey, Devon, Emery, Finley, Gray, Harper.');
      expect(answer.turn.citations).toHaveLength(8); expect(answer.turn.citations.every(c => c.kind === 'student')).toBe(true);
      expect(answer.turn.actions).toEqual([]);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps a how-many or which-students performance question out of the roster shortcut', async () => {
    const repo = seeded();
    const answer = await askClassroomAssistant(repo, { requestId: 'performance-roster-wording', message: 'Which students in my class need help with the work?', mode: 'fixture' });
    expect(answer.turn.content).not.toContain('Your 8 students are:');
    expect(answer.turn.citations.some(c => c.kind === 'response')).toBe(true);
  });
  it('explains sample limits for unsupported questions instead of pretending to answer them', async () => {
    const repo = seeded(), fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const answer = await askClassroomAssistant(repo, { requestId: 'sample-limits', message: 'What is the school lunch today?', mode: 'fixture' });
    expect(answer.turn.content).toContain('Choose Live AI for a response to this question');
    expect(answer.turn.content).not.toContain('equal-length fraction strips'); expect(fetcher).not.toHaveBeenCalled();
  });
  it('accepts live roster membership with each own roster source but keeps performance checks strict', async () => {
    const repo = seeded(); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const names = repo.state.students.map(s => s.displayName).join(', '), sourceIds = repo.state.students.map(s => `student:${s.id}`);
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response({ answer: `Your current roster has eight students: ${names}.`, sourceIds, actions: [] })));
    vi.stubGlobal('fetch', fetcher);
    const result = await askClassroomAssistant(repo, { requestId: 'live-roster', message: 'Who are my students?', mode: 'live' });
    expect(result.turn.content).toContain(names); expect(fetcher).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(JSON.parse(fetcher.mock.calls[0][1].body).messages[1].content);
    expect(sent.context.roster).toHaveLength(8); expect(sent.context.classroom).toBeUndefined();
    expect(result.turn.contextDisclosure?.responseCount).toBe(0);
    fetcher.mockImplementation(() => Promise.resolve(response({ answer: 'Casey is ready for extension.', sourceIds: ['student:stu-03'], actions: [] })));
    await expect(askClassroomAssistant(repo, { requestId: 'roster-extra-claim', message: 'Who are my students?', mode: 'live' })).rejects.toMatchObject({ code: 'AI_INVALID_ROSTER' });
    expect(repo.state.assistant?.turns.filter(t => t.role === 'assistant')).toHaveLength(1);
  });
  it('repairs a missing student citation once with concrete feedback, without changing teacher data', async () => {
    const repo = seeded(), before = domainState(repo.state), context = buildAssistantContext(repo.state);
    const casey = context.classroom.assignments[4].responses.find(r => r.studentId === 'stu-03' && r.result === 'unanswered')!;
    const answer = 'Casey has a blank answer on the Independent check. Ask for one fresh explanation before choosing additional support.';
    const fetcher = vi.fn().mockResolvedValueOnce(response({ answer, sourceIds: ['student:stu-03'], actions: [] })).mockResolvedValueOnce(response({ answer, sourceIds: [casey.sourceId], actions: [] }));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const result = await askClassroomAssistant(repo, { requestId: 'repair-one', message: 'What next for Casey?', mode: 'live' });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(result.turn.citations[0].id).toBe(casey.sourceId);
    expect(result.turn.contextDisclosure?.text).toContain('one correction pass');
    expect(repo.state.assistant?.turns).toHaveLength(2); expect(domainState(repo.state)).toEqual(before);
    const repair = JSON.parse(JSON.parse(fetcher.mock.calls[1][1].body).messages[2].content);
    expect(repair.validationFeedback.missingStudents[0].name).toBe('Casey');
    expect(repair.validationFeedback.instruction).toContain('matching the claim and work date');
    expect(repair.validationFeedback.missingStudents[0].availableEvidence.every((s:{id:string}) => /^s\d+$/.test(s.id))).toBe(true);
  });
  it('does not weaken citation checks when the single repair is still invalid', async () => {
    const repo = seeded(); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response({ answer: 'Casey needs support.', sourceIds: ['student:stu-03'], actions: [] })));
    vi.stubGlobal('fetch', fetcher);
    await expect(askClassroomAssistant(repo, { requestId: 'repair-still-invalid', message: 'Help Casey', mode: 'live' })).rejects.toMatchObject({ code: 'AI_WRONG_STUDENT_SOURCE' });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(repo.state.assistant?.turns).toHaveLength(1);
  });
  it('does not start a repair after classroom evidence changes or the repair window closes', async () => {
    const repo = seeded(); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const fetcher = vi.fn().mockImplementation(() => { repo.state.responses[0].answerText = '5/6'; return Promise.resolve(response({ answer: 'Casey needs support.', sourceIds: ['student:stu-03'], actions: [] })); });
    vi.stubGlobal('fetch', fetcher);
    await expect(askClassroomAssistant(repo, { requestId: 'repair-stale', message: 'Help Casey', mode: 'live' })).rejects.toMatchObject({ code: 'ASSISTANT_STALE' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    let current = 100000; const clock = vi.spyOn(Date, 'now').mockImplementation(() => current);
    try {
      fetcher.mockImplementation(() => { current += 41000; return Promise.resolve(response({ answer: 'Casey needs support.', sourceIds: ['student:stu-03'], actions: [] })); });
      await expect(askClassroomAssistant(repo, { requestId: 'repair-too-late', message: 'Help Casey', mode: 'live' })).rejects.toMatchObject({ code: 'AI_WRONG_STUDENT_SOURCE' });
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally { clock.mockRestore(); }
  });
  it('repairs internal question labels into teacher language before saving', async () => {
    const repo = seeded(), context = buildAssistantContext(repo.state), sourceId = context.classroom.assignments[4].responses.find(r => r.studentId === 'stu-03')!.sourceId;
    const fetcher = vi.fn().mockResolvedValueOnce(response({ answer: 'Ask Casey to finish ic03.', sourceIds: [sourceId], actions: [] })).mockResolvedValueOnce(response({ answer: 'Ask Casey to complete question 3 on the Independent check, then explain the common unit.', sourceIds: [sourceId], actions: [] }));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const result = await askClassroomAssistant(repo, { requestId: 'repair-label', message: 'One step for Casey', mode: 'live' });
    expect(result.turn.content).not.toContain('ic03'); expect(fetcher).toHaveBeenCalledTimes(2);
  });
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
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response(body))));
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
    expect(brief.brief.actions.some(action => action.description.includes('Check:'))).toBe(true); expect(brief.brief.actions.some(action => action.description.includes('equal-length fraction strips'))).toBe(true); expect(brief.brief.content).toContain('Avery');
    const lesson = await askClassroomAssistant(repo, { requestId: 'old-lesson', message: 'Help me teach this lesson', scope: { lessonId: 'lesson-2026-09-23' }, mode: 'fixture' });
    expect(lesson.turn.content).toContain('First check:'); expect(lesson.turn.content).not.toContain('Independent check'); expect(lesson.turn.content).toContain('Worked example:');
    const compare = await askClassroomAssistant(repo, { requestId: 'compare', message: 'Compare Casey’s progress', mode: 'fixture' });
    expect(compare.turn.content).toContain('Casey:'); expect(compare.turn.content).toContain('not a standardized growth measure');
  });
  it('rejects a Casey claim supported only by Avery’s work or a roster citation', async () => {
    const repo = seeded(), context = buildAssistantContext(repo.state), avery = context.classroom.assignments[0].responses.find(r => r.studentId === 'stu-01')!;
    vi.stubEnv('OPENROUTER_API_KEY', 'test');
    for (const [index, id] of [avery.sourceId!, 'student:stu-03'].entries()) {
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response({ answer: 'Casey independently solved every First check answer correctly and is ready for extension.', sourceIds: [id], actions: [] }))));
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

describe('learning-first classroom briefings', () => {
  it('sends dated learning patterns and actionable follow-ups with resolvable sources to both providers', () => {
    const repo = seeded(), context = buildAssistantContext(repo.state, { templateId: 'followup-template-v1' });
    for (const provider of ['deepseek', 'openrouter'] as const) {
      const model = buildAssistantModelContext(context, provider, 'Describe learning development');
      const learning = model.classroom.learningDevelopment[0];
      expect(model.focus.templateId).toBe('followup-template-v1');
      expect(learning.throughDate).toBe('2026-09-24'); expect(learning.trends.length).toBeGreaterThan(0);
      expect(learning.followUps.length).toBeGreaterThan(0);
      const refIds = [...learning.trends.flatMap(trend => trend.evidence), ...learning.followUps.flatMap(followUp => followUp.evidence)];
      const refs = refIds.map(id => model.classroom.learningEvidence.find(ref => ref.id === id)!);
      expect(refs.some(ref => ref.activityDate === '2026-09-22')).toBe(true);
      expect(refs.every(ref => ref.activityDate <= learning.throughDate)).toBe(true);
      for (const ref of refs) {
        expect(ref.source).toMatch(/^s\d+$/);
        expect(context.sources[Number(ref.source!.slice(1)) - 1]).toBeDefined();
        expect(model.classroom.supportRecords[ref.supportRecord]).toBeDefined();
        expect(ref.taskDifficulty).toBeTruthy();
      }
    }
  });

  it('deduplicates both model payloads while retaining every answer, dated help, saved edit, goal and deadline', () => {
    const repo = seeded();
    repo.state.planVersions[0].snapshot.blocks[0].instructions = 'A teacher-specific saved opening.';
    repo.state.assistant = { revision: 0, goals: { text: 'Keep common-unit explanations visible.', revision: 1, updatedAt: null }, turns: [], briefs: [], requests: [] };
    const context = buildAssistantContext(repo.state, { templateId: assignments[4].templateId });
    for (const provider of ['deepseek', 'openrouter'] as const) {
      const model = buildAssistantModelContext(context, provider);
      const serialized = JSON.stringify(model);
      expect(serialized.length).toBeLessThan(140_000);
      expect(serialized.length).toBeLessThan(JSON.stringify(context).length * .35);
      expect(model.classroom.assignments.flatMap(assignment => assignment.responses)).toHaveLength(120);
      for (const assignment of context.classroom.assignments) {
        const rows = model.classroom.assignments.find(item => item.templateId === assignment.templateId)!.responses;
        expect(rows.map(row => [row[6], row[7]])).toEqual(assignment.responses.map(row => [row.workingText, row.answerText]));
      }
      expect(serialized).toContain('A teacher-specific saved opening.');
      expect(model.classroom.goals.text).toBe('Keep common-unit explanations visible.');
      expect(model.classroom.plans).toHaveLength(5);
      expect(model.classroom.calendar.some(row => row[1] === '2026-10-02' && row[5] === true)).toBe(true);
      expect(model.classroom.learningDevelopment).toHaveLength(1);
      const allRefs = model.classroom.learningDevelopment.flatMap(item => [...item.trends.flatMap(trend => trend.evidence), ...item.followUps.flatMap(followUp => followUp.evidence), ...(item.lessonDirection?.evidence ?? [])]);
      expect(model.classroom.learningEvidence).toHaveLength(new Set(allRefs).size);
      expect(allRefs.length).toBeGreaterThan(model.classroom.learningEvidence.length);
      expect(model.contextDisclosure).toContain('Derived learning interpretations are supplied only for the focused assignment horizon');
    }
  });

  it('makes current and prior method facts readable, and dates every current note version', () => {
    const state = createInitialState('teacher');
    for (const assignment of assignments) { const batch = seedAssignment(state, assignment.templateId, { support: assignment.sequence === 3 ? 'supported' : 'independent' }); analyzeBatch(state, { batchId: batch.id, provenance: testProvenance }); }
    const context = buildAssistantContext(state, { templateId: assignments[4].templateId });
    for (const provider of ['deepseek', 'openrouter'] as const) {
      const model = buildAssistantModelContext(context, provider), c = model.classroom;
      const casey = c.focusedEvidenceFacts.filter(fact => fact.studentId === 'stu-03');
      expect(casey.filter(fact => fact.workDate === '2026-09-25').length).toBeGreaterThan(0);
      expect(casey.filter(fact => fact.workDate === '2026-09-25').every(fact => fact.help.level === 'supported' && fact.commonUnitMethodShown && !fact.denominatorErrorShown)).toBe(true);
      expect(casey.filter(fact => fact.workDate === '2026-09-30' && fact.questionNumber < 3).every(fact => fact.result === 'correct' && fact.reasoning === 'demonstrated' && fact.help.level === 'independent' && fact.commonUnitMethodShown && !fact.denominatorErrorShown)).toBe(true);
      expect(casey.find(fact => fact.workDate === '2026-09-30' && fact.questionNumber === 3)?.methodFact).toContain('does not establish a misconception');
      const dateIndex = c.tableColumns.notes.indexOf('workDate'), assignmentIndex = c.tableColumns.notes.indexOf('templateId');
      expect(c.currentNotes.every(note => typeof note[dateIndex] === 'string' && typeof note[assignmentIndex] === 'string')).toBe(true);
      expect(c.currentNotes.some(note => note[1] === 'stu-03' && note[dateIndex] === '2026-09-22')).toBe(true);
      expect(c.currentNotesMeaning).toContain('not all diagnoses of latest work');
      expect(model.sources.some(source => String(source[2]).includes('Casey · 2026-09-25'))).toBe(true);
    }
  });

  function oneLearnerNeedsLessHelp() {
    const state = createInitialState('teacher');
    for (const assignment of assignments) {
      const batch = seedAssignment(state, assignment.templateId);
      if (assignment.sequence === 3) state.submissions.find(submission => submission.batchId === batch.id && submission.studentId === 'stu-03')!.support = { level: 'supported', source: 'teacher-recorded', note: 'A common-denominator prompt and fraction strips were provided.' };
      analyzeBatch(state, { batchId: batch.id, provenance: testProvenance });
    }
    const context = buildAssistantContext(state, { templateId: assignments[4].templateId });
    expect(context.classroom.learningDevelopment.at(-1)!.trends.filter(trend => trend.kind === 'less_help').flatMap(trend => trend.studentIds)).toEqual(['stu-03']);
    const earlier = context.classroom.assignments[2].responses.find(row => row.studentId === 'stu-03')!.sourceId!;
    const later = context.classroom.assignments[4].responses.find(row => row.studentId === 'stu-03')!.sourceId!;
    return { repo: new MemoryRepository(state), sourceIds: [earlier, later], comparisons: [{ studentId: 'stu-03', earlierSourceId: earlier, laterSourceId: later }] };
  }

  it.each([
    'Most students now show correct common-unit fraction addition with less help.',
    'All students now need less support.',
    'The whole class is increasingly independent.',
  ])('rejects an unsupported class-wide support change: %s', async answer => {
    const { repo, sourceIds } = oneLearnerNeedsLessHelp();
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(briefResponse({ answer, sourceIds, comparisons: [], actions: [] })));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    await expect(generateClassroomBrief(repo, { requestId: 'support-quantifier', mode: 'live' })).rejects.toMatchObject({ code: 'AI_SUPPORT_GENERALIZATION' });
    const feedback = JSON.parse(JSON.parse(fetcher.mock.calls[1][1].body).messages.at(-1).content).validationFeedback;
    expect(feedback.supportedTrend).toMatchObject({ studentNames: ['Casey'], count: 1, classSize: 8, throughDate: '2026-09-30' });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(repo.state.assistant?.briefs).toHaveLength(0);
  });

  it.each([
    'Most students now show correct common-unit fraction addition independently.',
    'Most students now work independently. Casey needs less help than on Sep 25.',
    'Most students now work independently, while Casey needs less help than on Sep 25.',
    'Most students now work independently; Casey needs less help than on Sep 25.',
    'Not all students need less help. Casey worked with support on Sep 25 and independently on Sep 30.',
  ])('keeps current independence and named support-change clauses distinct: %s', async answer => {
    const { repo, sourceIds, comparisons } = oneLearnerNeedsLessHelp();
    const fetcher = vi.fn().mockResolvedValue(briefResponse({ answer, sourceIds, comparisons: answer.includes('Casey') ? comparisons : [], actions: [] }));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const { brief } = await generateClassroomBrief(repo, { requestId: 'scoped-help-change', mode: 'live' });
    expect(brief.content).toBe(answer); expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('repairs the actual false Casey claim and leaked aliases without rewriting provider text itself', async () => {
    const repo = seeded(), context = buildAssistantContext(repo.state);
    const earlierRows = context.classroom.assignments[2].responses.filter(row => row.studentId === 'stu-03');
    const laterRows = context.classroom.assignments[4].responses.filter(row => row.studentId === 'stu-03' && row.questionId !== 'ic03');
    const sourceIds = [...earlierRows, ...laterRows].map(row => row.sourceId!);
    const alias = (id: string) => `s${context.sources.findIndex(source => source.id === id) + 1}`;
    const comparisons = [{ studentId: 'stu-03', earlierSourceId: alias(sourceIds[0]), laterSourceId: alias(sourceIds[3]) }];
    const falseClaim = `Casey's Sep 25 work (${sourceIds.slice(0, 3).map(alias).join(', ')}) and Sep 30 work (${sourceIds.slice(3).map(alias).join(', ')}) show the same denominator-addition error.`;
    const corrected = 'Keep the planned practice moving and check any unfinished responses.\n\nCasey’s Sep 25 and Sep 30 cited answers show correct common-unit working. Do not use an earlier denominator-addition difficulty as the diagnosis of these later answers.';
    const fetcher = vi.fn().mockResolvedValueOnce(briefResponse({ answer: falseClaim, sourceIds: sourceIds.map(alias), comparisons, actions: [] })).mockResolvedValueOnce(briefResponse({ answer: corrected, sourceIds: sourceIds.map(alias), comparisons, actions: [] }));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const { brief } = await generateClassroomBrief(repo, { requestId: 'casey-actual-false-claim', mode: 'live' });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(brief.content).toBe(corrected);
    const feedback = JSON.parse(JSON.parse(fetcher.mock.calls[1][1].body).messages.at(-1).content).validationFeedback;
    expect(JSON.stringify(feedback)).toContain('AI_INTERNAL_LABEL'); expect(JSON.stringify(feedback)).toContain('AI_MATH_CONTRADICTION');
    expect(repo.state.assistant?.briefs).toHaveLength(1);
  });

  it('rejects the false denominator claim even without aliases, but permits a real dated earlier error', async () => {
    const repo = seeded(), context = buildAssistantContext(repo.state);
    const earlier = context.classroom.assignments[2].responses.find(row => row.studentId === 'stu-03')!.sourceId!;
    const later = context.classroom.assignments[4].responses.find(row => row.studentId === 'stu-03')!.sourceId!;
    const draft = { answer: 'Casey’s Sep 25 work and Sep 30 work show the same denominator-addition error.', sourceIds: [earlier, later], comparisons: [{ studentId: 'stu-03', earlierSourceId: earlier, laterSourceId: later }], actions: [] };
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(briefResponse(draft)));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    await expect(generateClassroomBrief(repo, { requestId: 'false-math-without-alias', mode: 'live' })).rejects.toMatchObject({ code: 'AI_MATH_CONTRADICTION' });
    expect(repo.state.assistant?.briefs).toHaveLength(0);
    const actualEarlier = context.classroom.assignments[0].responses.find(row => row.studentId === 'stu-03')!.sourceId!;
    fetcher.mockReset().mockResolvedValue(briefResponse({ answer: 'Casey added denominators on Sep 22, but the cited Sep 30 work shows a correct common-unit method. Check the unfinished work next; do not label the later answers as denominator-addition errors.', sourceIds: [actualEarlier, later], comparisons: [{ studentId: 'stu-03', earlierSourceId: actualEarlier, laterSourceId: later }], actions: [] }));
    const { brief } = await generateClassroomBrief(repo, { requestId: 'real-earlier-error', mode: 'live' });
    expect(brief.content).toContain('on Sep 22'); expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retains thirteen grounded brief citations for two dated comparisons, current follow-ups and the lesson', async () => {
    const repo = seeded(), context = buildAssistantContext(repo.state);
    const prior = context.classroom.assignments[2].responses;
    const current = context.classroom.assignments[4].responses;
    const priorCasey = prior.filter(row => row.studentId === 'stu-03');
    const priorGray = prior.filter(row => row.studentId === 'stu-07').slice(0, 2);
    const currentCasey = current.filter(row => row.studentId === 'stu-03');
    const currentGray = current.filter(row => row.studentId === 'stu-07').slice(0, 2);
    const devon = current.find(row => row.studentId === 'stu-04' && row.questionId === 'ic02')!;
    const harper = current.find(row => row.studentId === 'stu-08' && row.questionId === 'ic02')!;
    const lesson = context.classroom.plans.find(plan => plan.lessonId === assignments[4].targetLessonId)!;
    const sourceIds = [...priorCasey, ...priorGray, ...currentCasey, ...currentGray, devon, harper].map(row => row.sourceId!).concat(lesson.sourceId);
    expect(sourceIds).toHaveLength(13);
    const comparisons = [
      { studentId: 'stu-03', earlierSourceId: priorCasey[0].sourceId!, laterSourceId: currentCasey[0].sourceId! },
      { studentId: 'stu-07', earlierSourceId: priorGray[0].sourceId!, laterSourceId: currentGray[0].sourceId! },
    ];
    const answer = 'Keep the saved practice moving while checking unfinished work and the numerator sum.\n\nCasey and Gray show correct common-unit working on the cited Sep 25 and Sep 30 answers. Casey’s last answer is unfinished. Ask Devon to recheck the addition after valid renaming, and ask Harper where the unfinished answer stopped. Use these checks within the saved lesson.';
    const fetcher = vi.fn().mockResolvedValue(briefResponse({ answer, sourceIds, comparisons, actions: [] }));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const { brief } = await generateClassroomBrief(repo, { requestId: 'thirteen-grounded-sources', mode: 'live' });
    expect(brief.citations.map(source => source.id)).toEqual(sourceIds); expect(fetcher).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.response_format.json_schema.schema.properties.sourceIds.maxItems).toBe(24);
    expect(JSON.parse(body.messages[1].content).replyLimits.maxSourceIds).toBe(24);
    expect(repo.state.assistant?.brief?.citations).toHaveLength(13);
  });

  it.each([24, 25])('enforces the live briefing citation boundary at %s sources', async count => {
    const repo = seeded(), context = buildAssistantContext(repo.state);
    const sourceIds = context.classroom.assignments.flatMap(assignment => assignment.responses).map(row => row.sourceId!).slice(0, count);
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(briefResponse({ answer: 'Inspect the submitted work and recorded help before choosing the next teaching step.', sourceIds, comparisons: [], actions: [] })));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const pending = generateClassroomBrief(repo, { requestId: `brief-source-boundary-${count}`, mode: 'live' });
    if (count === 24) { expect((await pending).brief.citations).toHaveLength(24); expect(fetcher).toHaveBeenCalledTimes(1); }
    else { await expect(pending).rejects.toMatchObject({ code: 'AI_INVALID_OUTPUT' }); expect(fetcher).toHaveBeenCalledTimes(2); expect(repo.state.assistant?.briefs).toHaveLength(0); }
  });

  it.each([12, 13])('preserves the chat citation boundary at %s sources', async count => {
    const repo = seeded(), sourceIds = buildAssistantContext(repo.state).classroom.assignments[0].responses.map(row => row.sourceId!).slice(0, count);
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(response({ answer: 'Inspect the submitted work before deciding which explanation to model next.', sourceIds, actions: [] })));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const pending = askClassroomAssistant(repo, { requestId: `chat-source-boundary-${count}`, message: 'What should I teach next?', mode: 'live' });
    if (count === 12) { expect((await pending).turn.citations).toHaveLength(12); expect(fetcher).toHaveBeenCalledTimes(1); }
    else { await expect(pending).rejects.toMatchObject({ code: 'AI_INVALID_OUTPUT' }); expect(fetcher).toHaveBeenCalledTimes(2); }
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.response_format.json_schema.schema.properties.sourceIds.maxItems).toBe(12);
    expect(JSON.parse(body.messages[1].content).replyLimits.maxSourceIds).toBe(12);
  });

  it('repairs a declared comparison whose earlier source is missing from the selected citations', async () => {
    const repo = seeded(), context = buildAssistantContext(repo.state);
    const earlier = context.classroom.assignments[0].responses.find(row => row.studentId === 'stu-03')!.sourceId!;
    const latest = context.classroom.assignments[4].responses.find(row => row.studentId === 'stu-03')!.sourceId!;
    const draft = { answer: 'Check whether Casey can explain the common unit on a fresh sum.\n\nCasey added unlike denominators on Sep 22; on Sep 30 the written method renamed to tenths without recorded help. These different tasks do not establish mastery.', sourceIds: [latest], comparisons: [{ studentId: 'stu-03', earlierSourceId: earlier, laterSourceId: latest }], actions: [] };
    const fetcher = vi.fn().mockResolvedValueOnce(briefResponse(draft)).mockResolvedValueOnce(briefResponse({ ...draft, sourceIds: [earlier, latest] }));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const { brief } = await generateClassroomBrief(repo, { requestId: 'paired-repair', scope: { templateId: assignments[4].templateId }, mode: 'live' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(brief.citations.map(source => source.id)).toEqual([earlier, latest]);
    const repair = JSON.parse(JSON.parse(fetcher.mock.calls[1][1].body).messages.at(-1).content);
    expect(JSON.stringify(repair.validationFeedback)).toContain('Both comparison sources must be included in sourceIds');
    expect(brief).not.toHaveProperty('comparisons');
    expect(repo.state.assistant?.briefs).toHaveLength(1);
  });

  it('rejects another learner’s earlier citation and leaves the failed briefing unsaved', async () => {
    const repo = seeded(), context = buildAssistantContext(repo.state);
    const wrongEarlier = context.classroom.assignments[0].responses.find(row => row.studentId === 'stu-01')!.sourceId!;
    const latest = context.classroom.assignments[4].responses.find(row => row.studentId === 'stu-03')!.sourceId!;
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(briefResponse({ answer: 'Check Casey’s method on a fresh sum.\n\nCasey used a different method earlier and now renames correctly.', sourceIds: [wrongEarlier, latest], comparisons: [{ studentId: 'stu-03', earlierSourceId: wrongEarlier, laterSourceId: latest }], actions: [] })));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    await expect(generateClassroomBrief(repo, { requestId: 'wrong-pair', mode: 'live' })).rejects.toMatchObject({ code: 'AI_UNPAIRED_COMPARISON' });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(repo.state.assistant?.briefs).toHaveLength(0);
  });

  it.each(['reversed-dates', 'same-date', 'missing-pair', 'unknown-student', 'non-work-source'] as const)('rejects invalid declared comparison metadata: %s', async variant => {
    const repo = seeded(), context = buildAssistantContext(repo.state);
    const earlier = context.classroom.assignments[0].responses.find(row => row.studentId === 'stu-03')!.sourceId!;
    const later = context.classroom.assignments[4].responses.find(row => row.studentId === 'stu-03')!.sourceId!;
    const pair = { studentId: variant === 'unknown-student' ? 'not-in-roster' : 'stu-03', earlierSourceId: earlier, laterSourceId: later };
    if (variant === 'reversed-dates') { pair.earlierSourceId = later; pair.laterSourceId = earlier; }
    if (variant === 'same-date') pair.earlierSourceId = later;
    if (variant === 'non-work-source') pair.earlierSourceId = 'student:stu-03';
    const draft = { answer: 'Use a fresh explanation to check Casey’s fraction method.\n\nThe dated comparison remains tentative because task conditions differ.', sourceIds: variant === 'missing-pair' ? [later] : [earlier, later, ...(variant === 'non-work-source' ? ['student:stu-03'] : [])], comparisons: [pair], actions: [] };
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(briefResponse(draft)));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    await expect(generateClassroomBrief(repo, { requestId: variant, mode: 'live' })).rejects.toMatchObject({ code: 'AI_UNPAIRED_COMPARISON' });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(repo.state.assistant?.briefs).toHaveLength(0);
  });

  it('resolves comparison aliases to exact student/date evidence and never persists model-only metadata', async () => {
    const repo = seeded(), context = buildAssistantContext(repo.state);
    const earlier = context.classroom.assignments[0].responses.find(row => row.studentId === 'stu-03')!.sourceId!;
    const later = context.classroom.assignments[4].responses.find(row => row.studentId === 'stu-03')!.sourceId!;
    const alias = (id: string) => `s${context.sources.findIndex(source => source.id === id) + 1}`;
    const fetcher = vi.fn().mockResolvedValue(briefResponse({ answer: 'Check Casey’s method on a fresh sum.\n\nCasey added unlike denominators on Sep 22, while the Sep 30 answer renamed to tenths. These different tasks do not establish mastery.', sourceIds: [alias(earlier), alias(later)], comparisons: [{ studentId: 'stu-03', earlierSourceId: alias(earlier), laterSourceId: alias(later) }], actions: [] }));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const { brief } = await generateClassroomBrief(repo, { requestId: 'comparison-aliases', mode: 'live' });
    expect(brief.citations.map(source => source.id)).toEqual([earlier, later]);
    expect(brief.provenance.promptVersion).toBe('classroom-assistant-v12');
    expect(brief).not.toHaveProperty('comparisons'); expect(repo.state.assistant!.brief).not.toHaveProperty('comparisons');
    const schema = JSON.parse(fetcher.mock.calls[0][1].body).response_format.json_schema.schema;
    expect(schema.required).toContain('comparisons'); expect(schema.properties.comparisons.maxItems).toBe(2);
  });

  it('requires explicit comparison metadata rather than assuming a missing array means no comparisons', async () => {
    const repo = seeded(), sourceId = buildAssistantContext(repo.state).classroom.assignments[4].responses[0].sourceId!;
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ answer: 'Inspect this current answer.', sourceIds: [sourceId], actions: [] }) } }] }), { status: 200 })));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    await expect(generateClassroomBrief(repo, { requestId: 'missing-comparison-metadata', mode: 'live' })).rejects.toMatchObject({ code: 'AI_INVALID_COMPARISON' });
    expect(repo.state.assistant?.briefs).toHaveLength(0);
  });

  it('rejects a reviewed-work claim without cited teacher review and repairs it without manufacturing approval', async () => {
    const repo = seeded(), context = buildAssistantContext(repo.state);
    const sourceId = context.classroom.assignments[4].responses[0].sourceId!;
    const draft = { answer: 'The reviewed work suggests a short common-unit check before deciding what to teach next.', sourceIds: [sourceId], actions: [] };
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(briefResponse(draft)));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    await expect(generateClassroomBrief(repo, { requestId: 'unverified-claim', mode: 'live' })).rejects.toMatchObject({ code: 'AI_REVIEW_STATUS' });
    expect(repo.state.assistant?.briefs).toHaveLength(0);
    fetcher.mockReset().mockResolvedValueOnce(briefResponse(draft)).mockResolvedValueOnce(briefResponse({ ...draft, answer: 'The submitted work suggests a short common-unit check. This interpretation needs teacher review.' }));
    const { brief } = await generateClassroomBrief(repo, { requestId: 'review-status-repair', mode: 'live' });
    expect(brief.content).toContain('submitted work'); expect(brief.content).toContain('needs teacher review');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(repo.state.findings.every(finding => finding.status === 'candidate')).toBe(true);
    expect(repo.state.observations).toHaveLength(0);
  });

  it.each(['not reviewed', 'not yet verified', 'no teacher-reviewed'])('allows an honest negated review-status statement: %s', async phrase => {
    const repo = seeded(), sourceId = buildAssistantContext(repo.state).classroom.assignments[4].responses[0].sourceId!;
    const answer = `This is ${phrase} evidence. Inspect the submitted work before deciding what to teach next.`;
    const fetcher = vi.fn().mockResolvedValue(briefResponse({ answer, sourceIds: [sourceId], actions: [] }));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const { brief } = await generateClassroomBrief(repo, { requestId: `negative-${phrase}`, mode: 'live' });
    expect(brief.content).toBe(answer); expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('accepts three grounded current follow-ups without treating the name count as a safety failure', async () => {
    const repo = seeded(), context = buildAssistantContext(repo.state);
    const students = ['stu-03', 'stu-04', 'stu-08'];
    const sourceIds = students.map(studentId => context.classroom.assignments[4].responses.find(row => row.studentId === studentId && row.questionId === (studentId === 'stu-03' ? 'ic03' : 'ic02'))!.sourceId!);
    const answer = 'Keep the class moving with planned practice while using brief individual checks.\n\nDevon needs to recheck the numerator addition. Ask Casey where the unfinished third question stopped, and ask Harper to finish the second question while recording any help. These current follow-ups do not establish learning gains.';
    const fetcher = vi.fn().mockResolvedValue(briefResponse({ answer, sourceIds, actions: [] }));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const { brief } = await generateClassroomBrief(repo, { requestId: 'three-current-followups', mode: 'live' });
    expect(brief.content).toBe(answer); expect(brief.citations).toHaveLength(3);
    expect(brief.citations.every(source => source.label.includes('2026-09-30'))).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(repo.state.assistant?.briefs).toHaveLength(1);
  });

  it('rejects a long opening while preserving the concise teaching conclusion requirement', async () => {
    const repo = seeded(), sourceId = buildAssistantContext(repo.state).classroom.assignments[4].responses[0].sourceId!;
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(briefResponse({ answer: Array(81).fill('Review').join(' '), sourceIds: [sourceId], actions: [] })));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    await expect(generateClassroomBrief(repo, { requestId: 'long-opening', mode: 'live' })).rejects.toMatchObject({ code: 'AI_BRIEF_OPENING' });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(repo.state.assistant?.briefs).toHaveLength(0);
  });

  it('explains supported-to-independent working with both dated sources and keeps original help history', async () => {
    const state = createInitialState('teacher');
    for (const [templateId, support] of [['baseline-template-v1', 'supported'], ['followup-template-v1', 'independent']] as const) {
      const batch = seedAssignment(state, templateId, { studentIds: ['stu-07'], support });
      const findings = analyzeBatch(state, { batchId: batch.id, provenance: testProvenance });
      reviewFindings(state, { items: findings.map(finding => ({ findingId: finding.id, expectedRevision: finding.revision, decision: 'confirm' })), acknowledgeClearReadings: true });
    }
    const repo = new MemoryRepository(state), before = domainState(repo.state);
    const reply = await askClassroomAssistant(repo, { requestId: 'help-development', message: 'How has Gray’s independence changed?', scope: { studentId: 'stu-07', templateId: 'followup-template-v1' }, mode: 'fixture' });
    expect(reply.turn.content).toMatch(/with (?:recorded )?help earlier/);
    expect(reply.turn.content).toMatch(/independently on the later task|without recorded help/);
    expect(reply.turn.content).toContain('Sep 22 → Sep 24');
    expect(reply.turn.actions.some(action => action.description.includes('Check:'))).toBe(true);
    expect(reply.turn.content).not.toContain('usable answers correct');
    const citedObservations = reply.turn.citations.map(source => new URL(source.href, 'http://classroom').searchParams.get('observation')).filter(Boolean);
    expect(citedObservations).toHaveLength(2);
    expect(state.observations.filter(observation => citedObservations.includes(observation.id)).map(observation => observation.supportSnapshots[0].support.level)).toEqual(['supported', 'independent']);
    expect(domainState(repo.state)).toEqual(before);
  });

  it('keeps a selected historical briefing within its evidence dates and leads with meaning rather than scores', async () => {
    const repo = seeded();
    const { brief } = await generateClassroomBrief(repo, { requestId: 'earlier-learning', scope: { templateId: 'followup-template-v1' }, mode: 'fixture' });
    const firstParagraph = brief.content.split('\n\n')[0];
    expect(firstParagraph).not.toMatch(/\d+ correct|\d+ incorrect|\d+\/\d+ usable|%/);
    expect(brief.actions.some(action => action.description.includes('Check:'))).toBe(true); expect(brief.content).toContain('45-minute lesson');
    const citedBatches = brief.citations.filter(source => source.kind === 'response').map(source => source.href.match(/^\/review\/([^?]+)/)?.[1]);
    expect(citedBatches.length).toBeGreaterThan(1);
    expect(citedBatches.every(id => repo.state.batches.find(batch => batch.id === id)!.activityDate <= '2026-09-24')).toBe(true);
    expect(brief.content).not.toContain('Sep 30'); expect(brief.content).not.toContain('Word problems');
    expect(brief.content.split(/\s+/).length).toBeLessThan(320);
  });

  it('excludes later student work from a live historical briefing and rejects a supplied future citation', async () => {
    const repo = seeded(), context = buildAssistantContext(repo.state);
    const later = context.classroom.assignments[4].responses.find(response => response.studentId === 'stu-03')!;
    repo.state.responses.find(response => response.id === later.responseId)!.workingText = 'FUTURE_WORK_MUST_NOT_REACH_THE_MODEL';
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(briefResponse(rawReply(later.sourceId!))));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    await expect(generateClassroomBrief(repo, { requestId: 'future-source-rejected', scope: { templateId: 'followup-template-v1' }, mode: 'live' })).rejects.toMatchObject({ code: 'AI_UNGROUNDED_CITATION' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetcher.mock.calls[0][1].body), sent = JSON.parse(body.messages[1].content);
    expect(sent.context.classroom.assignments.map((assignment: { templateId: string }) => assignment.templateId)).toEqual(['baseline-template-v1', 'followup-template-v1']);
    expect(sent.context.classroom.learningDevelopment.every((learning: { throughDate: string }) => learning.throughDate <= '2026-09-24')).toBe(true);
    expect(sent.context.conversation).toEqual([]);
    expect(JSON.stringify(sent)).not.toContain('FUTURE_WORK_MUST_NOT_REACH_THE_MODEL');
    expect(sent.context.classroom.calendar.some((entry: unknown[]) => entry[1] === '2026-10-02')).toBe(true);
    expect(repo.state.assistant?.briefs).toHaveLength(0);
    // The broad chat context still has the saved later work when explicitly requested.
    expect(buildAssistantContext(repo.state).classroom.assignments[4].responses.find(response => response.responseId === later.responseId)!.workingText).toBe('FUTURE_WORK_MUST_NOT_REACH_THE_MODEL');
  });

  it('rejects a false named-student unfinished-work total in a learning brief', async () => {
    const repo = seeded(), context = buildAssistantContext(repo.state);
    const source = context.classroom.assignments[4].responses.find(row => row.studentId === 'stu-08' && row.questionId === 'ic02')!.sourceId!;
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(briefResponse({ answer: 'Ask Harper where she stopped.\n\nHarper left two Sep 30 answers unfinished.', sourceIds: [source], actions: [] })));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    await expect(generateClassroomBrief(repo, { requestId: 'wrong-total', mode: 'live' })).rejects.toMatchObject({ code: 'AI_BRIEF_ANSWER_TOTALS' });
    expect(repo.state.assistant?.briefs).toHaveLength(0);
  });

  it('repairs an answer tally into the specific task to check while keeping fractions and dates', async () => {
    const repo = seeded(), context = buildAssistantContext(repo.state);
    const source = context.classroom.assignments[4].responses.find(row => row.studentId === 'stu-08' && row.questionId === 'ic02')!.sourceId!;
    const answer = 'Ask Harper to finish question 2.\n\nOn Sep 30, Harper wrote 1/5 = 3/15 but left the answer blank. Ask what she tried and record any help.';
    const fetcher = vi.fn().mockResolvedValueOnce(briefResponse({ answer: 'Harper has two unfinished answers.', sourceIds: [source], actions: [] })).mockResolvedValueOnce(briefResponse({ answer, sourceIds: [source], actions: [{ title: 'Ask where Harper stopped', description: 'Time: 4 min\nDo: Ask what Harper tried.\nCheck: Record the finished work and any help.', sourceId: source }] }));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const { brief } = await generateClassroomBrief(repo, { requestId: 'repair-answer-total', mode: 'live' });
    expect(brief.content).toBe(answer); expect(fetcher).toHaveBeenCalledTimes(2);
    expect(brief.actions[0].description).toContain('Time: 4 min');
  });

  it('allows an accurate unfinished-work count when it supports a teaching action', async () => {
    const repo = seeded(), context = buildAssistantContext(repo.state);
    const source = context.classroom.assignments[4].responses.find(row => row.studentId === 'stu-08' && row.questionId === 'ic02')!.sourceId!;
    const answer = 'Ask Harper where she stopped.\n\nHarper left one Sep 30 answer unfinished. Ask her to finish question 2 and record any help.';
    const fetcher = vi.fn().mockResolvedValueOnce(briefResponse({ answer, sourceIds: [source], actions: [] }));
    vi.stubGlobal('fetch', fetcher); vi.stubEnv('OPENROUTER_API_KEY', 'test');
    const { brief } = await generateClassroomBrief(repo, { requestId: 'accurate-answer-total', mode: 'live' });
    expect(brief.content).toBe(answer); expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps old briefing content but marks a previous prompt version for refresh', async () => {
    const repo = seeded();
    await generateClassroomBrief(repo, { requestId: 'old-format', mode: 'fixture' });
    const brief = repo.state.assistant!.brief!;
    expect(getAssistantState(repo.state).brief?.stale).toBe(false);
    brief.provenance.promptVersion = 'classroom-assistant-v3';
    const stored = structuredClone(repo.state.assistant);
    const refreshed = getAssistantState(repo.state);
    expect(refreshed.brief?.stale).toBe(true);
    expect(refreshed.brief?.content).toBe(brief.content);
    expect(repo.state.assistant).toEqual(stored);
  });

  it('does not invent development before work has been submitted', async () => {
    const repo = new MemoryRepository();
    const { brief } = await generateClassroomBrief(repo, { requestId: 'no-development-yet', mode: 'fixture' });
    expect(brief.content).toContain('There is no submitted work');
    expect(brief.content).toContain('Check another task and record any help before judging progress');
    expect(brief.content).not.toContain('showed correct');
    expect(brief.actions.length).toBeGreaterThan(0);
  });
});
