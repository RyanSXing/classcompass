import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppState } from '@/lib/contracts';
import { createInitialState } from '@/lib/domain';
import { DomainError } from '@/lib/domain/errors';
import { configuration } from './config';
import type { Actor } from './auth';

export interface Repository {
  read(): Promise<AppState>;
  transact<T>(operation: (state: AppState) => T): Promise<T>;
}
export class LocalRepository implements Repository {
  constructor(readonly directory: string, readonly ownerId: string) {}
  private get filename() { return path.join(this.directory, 'state.json'); }
  private async lock<T>(operation: () => Promise<T>): Promise<T> {
    await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
    const lockfile = path.join(this.directory, 'state.lock');
    const token = randomUUID();
    for (let attempt = 0; attempt < 160; attempt++) {
      try {
        const file = await fs.open(lockfile, 'wx', 0o600);
        await file.writeFile(JSON.stringify({ pid: process.pid, token, time: Date.now() }));
        await file.close();
        try { return await operation(); }
        finally {
          const lock = await fs.readFile(lockfile, 'utf8').then(JSON.parse).catch(() => null);
          if (lock?.token === token) await fs.unlink(lockfile).catch(() => {});
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        const lock = await fs.readFile(lockfile, 'utf8').then(JSON.parse).catch(() => null);
        if (lock?.pid && Date.now() - lock.time > 30000) {
          let alive = true;
          try { process.kill(lock.pid, 0); } catch (e) { alive = (e as NodeJS.ErrnoException).code !== 'ESRCH'; }
          if (!alive) await fs.unlink(lockfile).catch(() => {});
        }
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }
    throw new DomainError('STORE_BUSY', 503, 'Another save is finishing. Please retry.');
  }
  private async load(): Promise<AppState> {
    try {
      const state = JSON.parse(await fs.readFile(this.filename, 'utf8')) as AppState;
      if (state.schemaVersion !== 1 || state.ownerId !== this.ownerId) throw new DomainError('STORE_VERSION', 503, 'The local store belongs to a different owner or schema.');
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return createInitialState(this.ownerId);
      throw error;
    }
  }
  private async save(state: AppState) {
    const temporary = `${this.filename}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
    await fs.rename(temporary, this.filename);
  }
  async read() {
    return this.lock(async () => { const state = await this.load(); await this.save(state); return state; });
  }
  async transact<T>(operation: (state: AppState) => T): Promise<T> {
    return this.lock(async () => {
      const state = await this.load();
      const result = operation(state);
      state.revision += 1;
      await this.save(state);
      return result;
    });
  }
}
export class SupabaseRepository implements Repository {
  constructor(private actor: Actor) {}
  async read(): Promise<AppState> {
    const { data, error } = await this.actor.client!.rpc('load_classcompass_state');
    if (error) throw new DomainError('DATABASE_READ', 503, 'Could not load the classroom. Check the database migrations.');
    return data ? data as AppState : createInitialState(this.actor.id);
  }
  async transact<T>(operation: (state: AppState) => T): Promise<T> {
    const state = await this.read();
    const previous = state.revision;
    const result = operation(state);
    state.revision++;
    const { error } = await this.actor.client!.rpc('commit_classcompass_state', { p_expected_revision: previous, p_state: state });
    if (error) {
      if (error.code === '40001') throw new DomainError('REVISION_CONFLICT', 409, 'This classroom changed in another session. Refresh and retry.');
      throw new DomainError('DATABASE_WRITE', 503, 'Could not save the classroom. Your draft is retained.');
    }
    return result;
  }
}
export function repository(actor: Actor): Repository {
  const config = configuration();
  return config.dataBackend === 'local' ? new LocalRepository(config.localDir, actor.id) : new SupabaseRepository(actor);
}
