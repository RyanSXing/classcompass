/** Authored task metadata, not student outcomes or model expectations. */
export type Assignment = {
  id: string;
  templateId: string;
  date: string;
  sequence: number;
  title: string;
  purpose: string;
  targetLessonId: string;
  sourceLessonId?: string;
  comparisonGroupId: string;
  eligibilityPolicy: { extensionMinimum: number; requiresPriorExtension: boolean };
  kind: 'baseline' | 'followup';
};

export const CATALOG_VERSION = 2;

export const assignments: Assignment[] = [
  { id: 'first-check', templateId: 'baseline-template-v1', date: '2026-09-22', sequence: 1, title: 'First check', purpose: 'Adding unlike fractions', targetLessonId: 'lesson-2026-09-23', comparisonGroupId: 'fraction-addition-mixed', eligibilityPolicy: { extensionMinimum: 3, requiresPriorExtension: false }, kind: 'baseline' },
  { id: 'quick-check', templateId: 'followup-template-v1', date: '2026-09-24', sequence: 2, title: 'Quick check', purpose: 'Short check after practice', sourceLessonId: 'lesson-2026-09-23', targetLessonId: 'lesson-2026-09-25', comparisonGroupId: 'fraction-addition-mixed', eligibilityPolicy: { extensionMinimum: 2, requiresPriorExtension: true }, kind: 'followup' },
  { id: 'fraction-practice', templateId: 'fraction-practice-template-v1', date: '2026-09-25', sequence: 3, title: 'Fraction practice', purpose: 'Calculations and explanations', sourceLessonId: 'lesson-2026-09-25', targetLessonId: 'lesson-2026-09-28', comparisonGroupId: 'fraction-addition-calculation', eligibilityPolicy: { extensionMinimum: 3, requiresPriorExtension: false }, kind: 'followup' },
  { id: 'word-problems', templateId: 'word-problems-template-v1', date: '2026-09-28', sequence: 4, title: 'Word problems', purpose: 'Working and units', sourceLessonId: 'lesson-2026-09-28', targetLessonId: 'lesson-2026-09-29', comparisonGroupId: 'fraction-addition-context', eligibilityPolicy: { extensionMinimum: 3, requiresPriorExtension: false }, kind: 'followup' },
  { id: 'independent-check', templateId: 'independent-check-template-v1', date: '2026-09-30', sequence: 5, title: 'Independent check', purpose: 'Work completed without help', targetLessonId: 'lesson-2026-10-01', comparisonGroupId: 'fraction-addition-mixed', eligibilityPolicy: { extensionMinimum: 3, requiresPriorExtension: false }, kind: 'followup' },
];

export function getAssignment(templateId: string): Assignment | undefined {
  return assignments.find(assignment => assignment.templateId === templateId);
}
