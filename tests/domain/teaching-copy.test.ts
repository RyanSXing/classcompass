import { describe, expect, it } from 'vitest';
import { teachingParts } from '../../lib/teaching-copy';

describe('teaching action presentation', () => {
  it('keeps every explicit instruction and check', () => {
    expect(teachingParts('Time: 4 min\nWith: Casey\nDo: Ask where Casey stopped.\nDo: Give one fresh question without hints.\nCheck: Record any help.')).toEqual({time:'4 min',who:'Casey',steps:['Ask where Casey stopped.','Give one fresh question without hints.'],check:'Record any help.',structured:true});
  });
  it('preserves unknown fields and unstructured saved text verbatim', () => {
    const text = 'Time: 5 min\nMaterials: fraction strips\nDo: Ask the student to explain.';
    expect(teachingParts(text).steps).toEqual([text]);
  });
  it('renders an existing saved duration and success check without losing the teaching step', () => {
    expect(teachingParts('5 min. Use a fresh question. Success check: The student explains equal parts.')).toEqual({time:'5 min',who:'',steps:['Use a fresh question.'],check:'The student explains equal parts.',structured:true});
  });
});
