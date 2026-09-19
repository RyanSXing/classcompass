import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import manifest from '../public/demo/manifest.json';
import fixtures from '../lib/fixtures/extractions.json';
import source from '../docs/fixtures/classroom.json';
import { assignments } from '../lib/assignments';
import { curriculum } from '../lib/curriculum';
import { lessonSchema } from '../lib/contracts';

describe('delivered demo assets', () => {
  it('ships the declared bytes and safe metadata for every asset', async () => {
    expect(manifest.assets).toHaveLength(59);
    expect(new Set(manifest.assets.map(asset => asset.id)).size).toBe(59);
    for (const asset of manifest.assets) {
      expect(asset.filename).not.toContain('/');
      expect(Object.keys(asset).every(key => ['id', 'filename', 'sha256', 'type', 'templateId', 'studentId'].includes(key))).toBe(true);
      const bytes = await fs.readFile(path.join(process.cwd(), 'public/demo', asset.filename));
      expect(createHash('sha256').update(bytes).digest('hex'), asset.filename).toBe(asset.sha256);
      if (asset.type === 'teacher-plan-import') expect(lessonSchema.safeParse(JSON.parse(bytes.toString())).success).toBe(true);
    }
    for (const [assetId, originalHash] of Object.entries(source.fixtureUsage.preservedSourceHashes)) {
      expect(manifest.assets.find(asset => asset.id === assetId)?.sha256, assetId).toBe(originalHash);
    }
  });
  it('maps all 40 scans and 120 responses to complete known question regions', async () => {
    const scans = manifest.assets.filter(asset => asset.type === 'fictional-handwritten-scan');
    expect(scans).toHaveLength(40);
    expect(Object.keys(fixtures)).toHaveLength(40);
    expect(Object.values(fixtures).reduce((sum, entry) => sum + entry.responses.length, 0)).toBe(120);
    for (const scan of scans) {
      const metadata = await sharp(path.join(process.cwd(), 'public/demo', scan.filename)).metadata();
      expect([metadata.width, metadata.height]).toEqual([1700, 2200]);
      const reference = fixtures[scan.sha256 as keyof typeof fixtures];
      expect(reference.templateId).toBe(scan.templateId);
      expect(reference.studentId).toBe(scan.studentId);
      const template = curriculum.templates.find(template => template.id === scan.templateId)!;
      expect(reference.responses.map(response => response.questionId)).toEqual(template.questionIds);
      expect(template.questionRegions.map(region => region.questionId)).toEqual(template.questionIds);
    }
    for (const assignment of assignments) {
      expect(scans.filter(scan => scan.templateId === assignment.templateId).map(scan => scan.studentId).sort()).toEqual(curriculum.roster.map(student => student.id).sort());
    }
  });
  it('keeps public assignment context aligned without leaking reference student work', () => {
    expect(assignments).toEqual(source.assignments);
    expect(assignments.map(assignment => assignment.date)).toEqual(['2026-09-22', '2026-09-24', '2026-09-25', '2026-09-28', '2026-09-30']);
    for (const assignment of assignments) {
      const lesson = curriculum.lessons.find(lesson => lesson.lessonId === assignment.targetLessonId)!;
      expect(lesson.date > assignment.date).toBe(true);
      expect(lesson.totalMinutes).toBe(45);
      expect(lesson.date < '2026-10-02').toBe(true);
    }
    const publicText = JSON.stringify(curriculum);
    for (const privateKey of ['writtenAnswer', 'recordedSupport', 'preparedExtraction', 'groundTruth', 'preparedCorrection']) expect(publicText).not.toContain(`"${privateKey}"`);
    expect(curriculum.calendar.find(entry => entry.date === '2026-10-02')?.locked).toBe(true);
  });
  it('discloses simulated flags while preserving literal source answers and blanks', () => {
    const original = Object.values(fixtures).find(entry => entry.studentId === 'stu-06' && entry.templateId === 'baseline-template-v1')!;
    expect(original.responses.find(response => response.questionId === 'q-03')?.answerText).toBe('1/5');
    expect(source.students[5].baseline.responses[2].writtenAnswer).toMatch(/1\/2$/);
    const later = Object.values(fixtures).find(entry => entry.studentId === 'stu-06' && entry.templateId === 'word-problems-template-v1')!;
    expect(later.responses[2].legibility).toBe('uncertain');
    expect(later.responses[2].uncertaintyNote).toMatch(/simulated/);
    expect(source.additionalSubmissions['word-problems-template-v1'][5].responses[2].answerText).toBe('7/20 meter');
    const harper = Object.values(fixtures).find(entry => entry.studentId === 'stu-08' && entry.templateId === 'independent-check-template-v1')!;
    expect(harper.responses[1]).toMatchObject({ answerText: null, workingText: '1/5 = 3/15', legibility: 'clear' });
  });
});
