import { describe, expect, it } from 'vitest';
import { extractionSchema } from '../../lib/contracts';
import { getQuestion } from '../../lib/curriculum';
import { checkMath, createInitialState, ingestExtraction, parseFraction } from '../../lib/domain';
import prepared from '../../lib/fixtures/extractions.json';
import { seedAssignment, testProvenance } from './helpers';

describe('literal answer labels in transcribed fractions', () => {
  it.each(['answer 2/5', 'Answer: 2/5', 'ANSWER:2/5', 'answer : 2/5', ' answer 2 / 5. '])('parses %s without discarding arbitrary prose', text => {
    expect(parseFraction(text)).toEqual({ numerator: 2, denominator: 5 });
  });

  it('checks a labeled fraction and its unit independently', () => {
    const result = checkMath(getQuestion('fq02'), '1/6 + 1/3 = 1/6 + 2/6 = 3/6 meter', 'Answer: 3/6 meter', 'clear');
    expect(result).toMatchObject({ status: 'correct', parsed: { numerator: 3, denominator: 6 }, unitStatus: 'correct', equivalentReasoning: true, checkerVersion: 3 });
    expect(checkMath(getQuestion('fq02'), '', 'answer 3/6', 'clear').unitStatus).toBe('missing');
    expect(checkMath(getQuestion('fq02'), '', 'answer 3/6 metres', 'uncertain').status).toBe('unresolved');
  });

  it('recognizes denominator addition from labeled results only when the working supports it', () => {
    expect(checkMath(getQuestion('q-01'), '1 + 1 = 2;\n2 + 3 = 5;', 'answer 2/5', 'clear')).toMatchObject({ status: 'incorrect', denominatorAddition: true });
    expect(checkMath(getQuestion('q-01'), '1/2 + 1/3 = 2/5', 'answer: 2/5', 'clear').denominatorAddition).toBe(true);
    expect(checkMath(getQuestion('q-01'), '', 'answer 2/5', 'clear').denominatorAddition).toBe(false);
    expect(checkMath(getQuestion('q-04'), '3 + 1 = 4;\n8 + 4 = 12;', 'answer 4/12 meter', 'clear')).toMatchObject({ status: 'incorrect', denominatorAddition: true, unitStatus: 'correct' });
  });

  it.each(['answer2/5', 'my answer is 2/5', 'answer answer 2/5', 'answer: 2/5 + 1/3', 'answer 2/5 = 4/10', 'answer 2/5 or 3/5', 'answer 2/5 because I added', 'answer 2/5 kilograms', 'answer 2/0'])('leaves unsafe or unsupported content unresolved: %s', text => {
    expect(parseFraction(text)).toBeNull();
    expect(checkMath(getQuestion('q-01'), '', text, 'clear').status).toBe('unresolved');
  });

  it('preserves the original labeled answer in the response and extraction', () => {
    const state = createInitialState('teacher');
    const batch = seedAssignment(state, 'baseline-template-v1', { studentIds: ['stu-02'], extract: false });
    const [hash, entry] = Object.entries(prepared).find(([, value]) => value.templateId === batch.templateId && value.studentId === 'stu-02')!;
    const draft = extractionSchema.parse({ templateId: batch.templateId, responses: entry.responses });
    draft.responses[0].answerText = 'answer 2/5';
    ingestExtraction(state, { submissionId: batch.submissionIds[0], assetHash: hash, draft, provenance: testProvenance });
    expect(state.responses[0]).toMatchObject({ answerText: 'answer 2/5', mathCheck: { status: 'incorrect', denominatorAddition: true } });
    expect(state.extractions[0].raw.responses[0].answerText).toBe('answer 2/5');
  });
});
