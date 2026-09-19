import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalRepository } from '../../lib/server/repository';
import { legacyState } from '../domain/helpers';
import { CATALOG_VERSION } from '../../lib/assignments';
import { curriculum } from '../../lib/curriculum';

let directory:string;
beforeEach(async()=>{directory=await fs.mkdtemp(path.join(os.tmpdir(),'classcompass-repository-'));});
afterEach(async()=>{await fs.rm(directory,{recursive:true,force:true});});
describe('local repository transactions',()=>{
 it('persists completed changes across independent repository instances',async()=>{const first=new LocalRepository(directory,'teacher');await first.transact(state=>{state.classroom.name='Saved classroom';});const reopened=await new LocalRepository(directory,'teacher').read();expect(reopened.classroom.name).toBe('Saved classroom');expect(reopened.revision).toBe(2);expect((await fs.stat(path.join(directory,'state.json'))).mode&0o777).toBe(0o600);});
 it('serializes concurrent updates with no lost increments or partial JSON files',async()=>{const repos=Array.from({length:16},()=>new LocalRepository(directory,'teacher'));await Promise.all(repos.map(repo=>repo.transact(state=>{state.classroom.evidenceRevision++;})));const state=await repos[0].read();expect(state.revision).toBe(17);expect(state.classroom.evidenceRevision).toBe(17);expect((await fs.readdir(directory)).filter(name=>name.endsWith('.tmp')||name.endsWith('.lock'))).toEqual([]);});
 it('rolls back thrown operations and releases the lock for the next save',async()=>{const repo=new LocalRepository(directory,'teacher');const before=await repo.read();await expect(repo.transact(state=>{state.classroom.name='Should not persist';throw Error('Domain rejection');})).rejects.toThrow('Domain rejection');expect(await repo.read()).toEqual(before);await repo.transact(state=>{state.classroom.name='Recovered';});expect((await repo.read()).classroom.name).toBe('Recovered');});
 it('refuses a persisted classroom belonging to another owner',async()=>{await new LocalRepository(directory,'teacher-a').read();await expect(new LocalRepository(directory,'teacher-b').read()).rejects.toThrow(/different owner/);});
 it('persists the catalog upgrade once when reopening a saved two-lesson classroom',async()=>{
  const legacy=legacyState();legacy.classroom.name='Saved teacher name';const originalVersions=structuredClone(legacy.planVersions);
  await fs.writeFile(path.join(directory,'state.json'),JSON.stringify(legacy));
  const repo=new LocalRepository(directory,'teacher'),upgraded=await repo.read();
  expect(upgraded.classroom.catalogVersion).toBe(CATALOG_VERSION);expect(upgraded.classroom.name).toBe('Saved teacher name');expect(upgraded.plans).toHaveLength(curriculum.lessons.length);expect(upgraded.planVersions.slice(0,2)).toEqual(originalVersions);expect(upgraded.revision).toBe(legacy.revision+1);
  expect(await new LocalRepository(directory,'teacher').read()).toEqual(upgraded);
  expect(JSON.parse(await fs.readFile(path.join(directory,'state.json'),'utf8'))).toEqual(upgraded);
 });
 it('does not partially save an upgrade when a caller transaction fails',async()=>{
  const original=JSON.stringify(legacyState());await fs.writeFile(path.join(directory,'state.json'),original);
  await expect(new LocalRepository(directory,'teacher').transact(()=>{throw Error('Rejected');})).rejects.toThrow('Rejected');
  expect(await fs.readFile(path.join(directory,'state.json'),'utf8')).toBe(original);
 });
});
