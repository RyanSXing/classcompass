import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAnalysisInput, completion, extractWorksheet } from '@/lib/server/ai';
import { configuration } from '@/lib/server/config';
import { askClassroomAssistant, buildAssistantContext } from '@/lib/server/assistant';
import { analyzeBatch, createInitialState, reviewFindings } from '@/lib/domain';
import type { AppState } from '@/lib/contracts';
import { seedAssignment, testProvenance } from '../domain/helpers';
import type { Repository } from '@/lib/server/repository';

const schema = { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema: { type: 'object', additionalProperties: false, properties: { answer: { type: 'string' } }, required: ['answer'] } } };
function provider(content: unknown) {
  vi.stubEnv('AI_PROVIDER', 'deepseek'); vi.stubEnv('DEEPSEEK_API_KEY', 'private-direct-test-key'); vi.stubEnv('OPENROUTER_API_KEY', 'unrelated-router-test-key');
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }), { status: 200 })); vi.stubGlobal('fetch', fetcher); return fetcher;
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('explicit direct DeepSeek provider', () => {
  it('defaults to free OpenRouter until direct provider is explicitly selected, then uses separate models and key', () => {
    vi.stubEnv('AI_PROVIDER', 'openrouter'); expect(configuration().reasoningModel).toContain(':free');
    vi.stubEnv('AI_PROVIDER', 'deepseek'); expect(configuration()).toMatchObject({ aiProvider: 'deepseek', visionModel: 'deepseek-flash', reasoningModel: 'deepseek-flash' });
    vi.stubEnv('AI_PROVIDER', 'untrusted-provider'); expect(() => configuration()).toThrow('AI_PROVIDER');
  });
  it('sends direct JSON mode and schema instructions with disabled thinking and no router parameters', async () => {
    const fetcher = provider({ answer: '3/4' });
    await expect(completion('deepseek-flash', [{ role: 'user', content: 'Answer the addition.' }], schema, 500, 'disabled')).resolves.toEqual({ answer: '3/4' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0], body = JSON.parse(init.body);
    expect(url).toBe('https://api.deepseek.com/chat/completions'); expect(init.headers.Authorization).toBe('Bearer private-direct-test-key');
    expect(init.headers).not.toHaveProperty('X-OpenRouter-Title'); expect(init.redirect).toBe('error');
    expect(body.response_format).toEqual({ type: 'json_object' }); expect(body.thinking).toEqual({ type: 'disabled' }); expect(body.temperature).toBe(0);
    expect(body).not.toHaveProperty('provider'); expect(body).not.toHaveProperty('reasoning'); expect(body).not.toHaveProperty('reasoning_effort');
    expect(body.messages[0].content).toContain('JSON Schema'); expect(body.messages[0].content).toContain('additionalProperties');
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Answer the addition.' });
  });
  it('uses explicitly requested low thinking only and never silently retries another provider', async () => {
    const fetcher = provider({ answer: '3/4' }); await completion('deepseek-flash', [], schema, 500, 'low');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ thinking: { type: 'enabled' }, reasoning_effort: 'low' }); expect(JSON.parse(fetcher.mock.calls[0][1].body)).not.toHaveProperty('temperature');
    fetcher.mockResolvedValue(new Response(JSON.stringify({ error: { message: 'private billing diagnostic' } }), { status: 402 }));
    await expect(completion('deepseek-flash', [], schema, 500)).rejects.toMatchObject({ code: 'AI_QUOTA', retryable: false });
    expect(fetcher).toHaveBeenCalledTimes(2); expect(fetcher.mock.calls.every(call => call[0] === 'https://api.deepseek.com/chat/completions')).toBe(true);
  });
  it('cannot use the OpenRouter key when the direct provider key is missing', async () => {
    const fetcher = provider({ answer: '3/4' }); vi.stubEnv('DEEPSEEK_API_KEY', '');
    await expect(completion('deepseek-flash', [], schema, 500)).rejects.toMatchObject({ code: 'AI_KEY_MISSING' }); expect(fetcher).not.toHaveBeenCalled();
  });
  it('supports direct vision with no reference key and validates the returned literal extraction', async () => {
    const draft = { templateId: 'baseline-template-v1', responses: ['q-01', 'q-02', 'q-03', 'q-04'].map(questionId => ({ questionId, workingText: '', answerText: null, legibility: 'blank', alternatives: [], uncertaintyNote: null })) };
    const fetcher = provider(draft);
    const extracted = await extractWorksheet({ templateId: draft.templateId, assetHash: 'not-a-fixture', bytes: Buffer.from('fake-image'), mimeType: 'image/png', mode: 'live' });
    expect(extracted.provenance.modelId).toBe('deepseek-flash'); expect(extracted.draft).toEqual(draft);
    const body = JSON.parse(fetcher.mock.calls[0][1].body); expect(body.model).toBe('deepseek-flash'); expect(body.thinking.type).toBe('disabled');
    expect(JSON.stringify(body.messages)).toContain('data:image/png;base64,'); expect(JSON.stringify(body.messages)).not.toContain('expectedAnswer');
    provider({ ...draft, responses: [] });
    await expect(extractWorksheet({ templateId: draft.templateId, assetHash: 'not-a-fixture', bytes: Buffer.from('fake-image'), mimeType: 'image/png', mode: 'live' })).rejects.toMatchObject({ code: 'AI_INVALID_OUTPUT' });
  });
  it('makes follow-up extension cite distinct current and prior response groups without lowering the gate', () => {
    const state = createInitialState('teacher'), baseline = seedAssignment(state);
    const findings = analyzeBatch(state, { batchId: baseline.id, provenance: testProvenance });
    reviewFindings(state, { items: findings.map(f => ({ findingId: f.id, expectedRevision: f.revision, decision: 'confirm' })), acknowledgeClearReadings: true });
    const followup = seedAssignment(state, 'followup-template-v1'), input = buildAnalysisInput(state, followup.id);
    const requirements = input.studentWork.find(s => s.studentId === 'stu-04')!.extensionEvidenceRequirements;
    expect(requirements.currentMinimum).toBe(2); expect(requirements.priorMinimum).toBe(3); expect(requirements.currentEligibleEvidence).toHaveLength(2); expect(requirements.priorEligibleEvidence.length).toBeGreaterThanOrEqual(3);
    expect(requirements.priorEligibleEvidence.every(ref => !requirements.currentEligibleEvidence.some(current => current.responseId === ref.responseId))).toBe(true);
    expect(input.eligibilityRules.extension).toContain('at least five distinct references total');
  });
  it('uses named full context and exact canonical citations for a direct assistant reply', async () => {
    let state = createInitialState('teacher');
    const repo: Repository = { read: async () => structuredClone(state), transact: async <T>(op: (value: AppState) => T) => { const next = structuredClone(state); const result = op(next); next.revision++; state = next; return result; } };
    const savedPlans = structuredClone(state.planVersions);
    const context = buildAssistantContext(state), source = context.sources.find(s => s.kind === 'assignment')!;
    const fetcher = provider({ answer: 'There is no submitted work for this assignment yet. Collect the worksheet before interpreting results.', sourceIds: [source.id], actions: [{ title: 'Open the assignment', description: 'Upload the known worksheet and record any help.', sourceId: source.id }] });
    const answer = await askClassroomAssistant(repo, { message: 'What next?', requestId: 'direct-assistant', mode: 'live' });
    expect(answer.turn.provenance).toMatchObject({ mode: 'live', modelId: 'deepseek-flash' }); expect(answer.turn.citations[0]).toEqual(source); expect(answer.turn.actions[0].href).toBe(source.href);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(state.planVersions).toEqual(savedPlans);
    const body = JSON.parse(fetcher.mock.calls[0][1].body), payload = JSON.parse(body.messages.at(-1).content);
    expect(payload.context.classroom.assignments[0].responses[0]).toHaveProperty('studentId'); expect(payload.context.classroom.plans[0]).toHaveProperty('teacherGuide');
    expect(payload.context.focusedContext).toHaveProperty('results'); expect(body.messages[0].content).toContain(source.id);
  });
});
