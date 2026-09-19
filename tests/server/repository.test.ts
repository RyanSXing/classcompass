import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalRepository } from '../../lib/server/repository';

let directory:string;
beforeEach(async()=>{directory=await fs.mkdtemp(path.join(os.tmpdir(),'classcompass-repository-'));});
afterEach(async()=>{await fs.rm(directory,{recursive:true,force:true});});
describe('local repository transactions',()=>{
 it('persists completed changes across independent repository instances',async()=>{const first=new LocalRepository(directory,'teacher');await first.transact(state=>{state.classroom.name='Saved classroom';});const reopened=await new LocalRepository(directory,'teacher').read();expect(reopened.classroom.name).toBe('Saved classroom');expect(reopened.revision).toBe(2);expect((await fs.stat(path.join(directory,'state.json'))).mode&0o777).toBe(0o600);});
 it('serializes concurrent updates with no lost increments or partial JSON files',async()=>{const repos=Array.from({length:16},()=>new LocalRepository(directory,'teacher'));await Promise.all(repos.map(repo=>repo.transact(state=>{state.classroom.evidenceRevision++;})));const state=await repos[0].read();expect(state.revision).toBe(17);expect(state.classroom.evidenceRevision).toBe(17);expect((await fs.readdir(directory)).filter(name=>name.endsWith('.tmp')||name.endsWith('.lock'))).toEqual([]);});
 it('rolls back thrown operations and releases the lock for the next save',async()=>{const repo=new LocalRepository(directory,'teacher');const before=await repo.read();await expect(repo.transact(state=>{state.classroom.name='Should not persist';throw Error('Domain rejection');})).rejects.toThrow('Domain rejection');expect(await repo.read()).toEqual(before);await repo.transact(state=>{state.classroom.name='Recovered';});expect((await repo.read()).classroom.name).toBe('Recovered');});
 it('refuses a persisted classroom belonging to another owner',async()=>{await new LocalRepository(directory,'teacher-a').read();await expect(new LocalRepository(directory,'teacher-b').read()).rejects.toThrow(/different owner/);});
});
