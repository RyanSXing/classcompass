import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import manifest from '../public/demo/manifest.json';
import fixtures from '../lib/fixtures/extractions.json';
import { lessonSchema } from '../lib/contracts';

describe('delivered demo assets', () => {
  it('ships exactly the declared bytes and safe metadata for every asset', async () => {
    expect(manifest.assets).toHaveLength(25);
    expect(new Set(manifest.assets.map(asset => asset.id)).size).toBe(25);
    for (const asset of manifest.assets) {
      expect(asset.filename).not.toContain('/');
      expect(Object.keys(asset).every(key => ['id', 'filename', 'sha256', 'type', 'templateId', 'studentId'].includes(key))).toBe(true);
      const bytes = await fs.readFile(path.join(process.cwd(), 'public/demo', asset.filename));
      expect(createHash('sha256').update(bytes).digest('hex'), asset.filename).toBe(asset.sha256);
      if (asset.type === 'teacher-plan-import') expect(lessonSchema.safeParse(JSON.parse(bytes.toString())).success).toBe(true);
    }
  });
  it('maps all 16 scans to the correct template and hash-keyed prepared transcription', async () => {
    const scans = manifest.assets.filter(asset => asset.type === 'fictional-handwritten-scan');
    expect(scans).toHaveLength(16);
    expect(Object.keys(fixtures)).toHaveLength(16);
    for (const scan of scans) {
      const metadata = await sharp(path.join(process.cwd(), 'public/demo', scan.filename)).metadata();
      expect([metadata.width, metadata.height]).toEqual([1700, 2200]);
      const reference = fixtures[scan.sha256 as keyof typeof fixtures];
      expect(reference.templateId).toBe(scan.templateId);
      expect(reference.studentId).toBe(scan.studentId);
      expect(reference.responses).toHaveLength(scan.templateId?.startsWith('baseline') ? 4 : 2);
    }
  });
});
