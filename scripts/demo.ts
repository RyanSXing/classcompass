import { config } from 'dotenv';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createInitialState } from '../lib/domain';
import { configuration, LOCAL_OWNER } from '../lib/server/config';
import { LocalRepository } from '../lib/server/repository';
import { loadDemo } from '../lib/server/demo';
config({ path: '.env.local', quiet: true });
const settings = configuration();
if (settings.dataBackend !== 'local' || settings.aiMode !== 'fixture') throw new Error('Seed/reset only supports local fixture mode. Connected setup is documented in docs/supabase-setup.md.');
const repo = new LocalRepository(settings.localDir, LOCAL_OWNER);
const operation = process.argv[2];
async function main() {
  if (operation === 'seed') {
    const state = await repo.read();
    if (state.batches.length) { console.log('Existing demo work preserved. Use the in-app upload flow to add another batch.'); return; }
    const result = await loadDemo({ id: LOCAL_OWNER, name: 'Demo teacher' }, repo, { phase: 'baseline' });
    console.log(`Baseline worksheets ready for teacher review: /review/${result.batchId}`);
  } else if (operation === 'reset' && process.argv.includes('--yes')) {
    // Restrict deletion to assets under the configured dedicated data directory.
    await repo.transact(state => Object.assign(state, createInitialState(LOCAL_OWNER)));
    await fs.rm(path.join(settings.localDir, 'assets'), { recursive: true, force: true });
    console.log('Local fictional work reset. Original authored assets are preserved.');
  } else throw new Error('Use npm run demo:seed, or npm run demo:reset -- --yes to clear the local fictional workspace.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
