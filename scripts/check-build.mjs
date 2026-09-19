import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const output = path.resolve(process.env.NEXT_DIST_DIR || '.next');
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]));
  return nested.flat();
}
const fixtures = JSON.parse(await readFile(path.join(root, 'lib/fixtures/extractions.json'), 'utf8'));
const privateHashes = Object.keys(fixtures);
const browserFiles = await walk(path.join(output, 'static'));
for (const filename of browserFiles) {
  const content = await readFile(filename);
  assert(!privateHashes.some(hash => content.includes(Buffer.from(hash))), `Private reference transcripts leaked into a browser asset: ${path.relative(output, filename)}`);
}
const traceFiles = (await walk(path.join(output, 'server'))).filter(filename => filename.endsWith('.nft.json'));
let fixtureTraced = false, demoTraced = false;
for (const filename of traceFiles) {
  const trace = JSON.parse(await readFile(filename, 'utf8'));
  for (const file of trace.files) {
    const resolved = path.resolve(path.dirname(filename), file);
    const relative = path.relative(root, resolved).split(path.sep).join('/');
    assert(!relative.startsWith('.local/') && !/^\.env(?:\.|$)/.test(relative), `Private runtime data was included in a production trace: ${relative}`);
    fixtureTraced ||= relative === 'lib/fixtures/extractions.json';
    demoTraced ||= relative === 'public/demo/baseline-stu-01.png';
  }
}
assert(fixtureTraced && demoTraced, 'The server bundle must retain the authored fixture transcripts and demo scans.');
console.log(`PASS: ${browserFiles.length} browser assets contain no reference transcript payload; ${traceFiles.length} server traces exclude local credentials/data and include required demo assets.`);
