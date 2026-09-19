import { config } from 'dotenv';
import { randomBytes, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createInitialState } from '../lib/domain';
import { curriculum } from '../lib/curriculum';
import { CATALOG_VERSION } from '../lib/assignments';
import { SupabaseRepository } from '../lib/server/repository';
import type { AppState } from '../lib/contracts';
config({path:'.env.local',quiet:true});
config({quiet:true});

const boundedFetch:typeof fetch=(input,init={})=>fetch(input,{...init,signal:AbortSignal.any([...(init.signal?[init.signal]:[]),AbortSignal.timeout(20000)])});
const clientOptions={auth:{persistSession:false,autoRefreshToken:false},db:{timeout:20000,retry:false},global:{fetch:boundedFetch}};
const safeResult=(result:{status?:number;error?:{code?:string;message?:string}|null})=>JSON.stringify({status:result.status,code:result.error?.code,message:result.error?.message?.slice(0,250)});
async function main() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, secret=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key||!secret){console.log('BLOCKED: Supabase isolation checks need project URL, publishable key and a local admin secret. No network calls or fixture substitutions performed.');process.exitCode=2;return;}
  const admin=createClient(url,secret,clientOptions), clients:SupabaseClient[]=[], userIds:string[]=[], paths:string[]=[];
  try {
    for(let i=0;i<2;i++){
      const email=`classcompass-check-${randomUUID()}@example.org`,password=`Cc!${randomBytes(24).toString('hex')}`;
      const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{display_name:'Temporary isolation check'}});
      assert.ifError(created.error);assert(created.data.user);userIds.push(created.data.user.id);
      const client=createClient(url,key,clientOptions);const session=await client.auth.signInWithPassword({email,password});assert.ifError(session.error);clients.push(client);
    }
    const [a,b]=clients,[ownerA,ownerB]=userIds;
    for(let i=0;i<2;i++){
      const initial=await clients[i].rpc('load_classcompass_state');assert.ifError(initial.error);assert.equal(initial.data,null);
      const state=createInitialState(userIds[i]);state.revision=2;
      const legacyIds=new Set(['lesson-2026-09-23','lesson-2026-09-25']);
      if(i===1){
        state.plans=state.plans.filter(plan=>legacyIds.has(plan.id));state.planVersions=state.planVersions.filter(version=>legacyIds.has(version.lessonId));delete state.classroom.catalogVersion;
        for(const entry of state.calendarEntries)if(entry.lessonId&&!legacyIds.has(entry.lessonId)){delete entry.lessonId;delete entry.planVersionId;}
      }
      const originalVersions=structuredClone(state.planVersions);
      const saved=await clients[i].rpc('commit_classcompass_state',{p_expected_revision:1,p_state:state});assert.ifError(saved.error);
      const loaded=await clients[i].rpc('load_classcompass_state');assert.ifError(loaded.error);assert.equal(loaded.data.ownerId,userIds[i]);assert.equal(loaded.data.students.length,8);assert.equal(loaded.data.planVersions.length,i===1?legacyIds.size:curriculum.lessons.length);assert.equal(loaded.data.revision,2);
      if(i===1){
        const repository=new SupabaseRepository({id:userIds[i],name:'Temporary migration check',client:clients[i]});const upgraded=await repository.read();
        assert.equal(upgraded.plans.length,curriculum.lessons.length);assert.equal(upgraded.classroom.catalogVersion,CATALOG_VERSION);assert.equal(upgraded.revision,3);
        assert.deepEqual(upgraded.planVersions.filter(version=>legacyIds.has(version.lessonId)),originalVersions,'Original lesson versions changed during the catalog upgrade');
        assert.deepEqual(await repository.read(),upgraded);
        console.log('PASS: a persisted two-lesson classroom gains five catalog lessons once, preserving original versions.');
      }
    }
    console.log('PASS: authenticated normalized state round-trip for two independent owners.');
    console.log('CHECK: stale revision rejection (20-second request limit).');
    const stateA=(await a.rpc('load_classcompass_state')).data as AppState;
    const stale=await a.rpc('commit_classcompass_state',{p_expected_revision:1,p_state:stateA});assert.equal(stale.error?.code,'PT409',`Stale revision result: ${safeResult(stale)}`);
    console.log('CHECK: simultaneous revision commits (20-second request limit).');
    const concurrentA=structuredClone(stateA),concurrentB=structuredClone(stateA);concurrentA.revision=3;concurrentB.revision=3;
    const outcomes=await Promise.all([a.rpc('commit_classcompass_state',{p_expected_revision:2,p_state:concurrentA}),a.rpc('commit_classcompass_state',{p_expected_revision:2,p_state:concurrentB})]);
    assert.equal(outcomes.filter(r=>!r.error).length,1);assert.equal(outcomes.find(r=>r.error)?.error?.code,'PT409',`Concurrent results: ${outcomes.map(safeResult).join('; ')}`);
    console.log('PASS: stale and simultaneous revision commits are rejected atomically.');
    const current=(await a.rpc('load_classcompass_state')).data as AppState;current.revision=4;
    const injected=structuredClone(current);injected.ownerId=ownerB;
    assert.equal((await a.rpc('commit_classcompass_state',{p_expected_revision:3,p_state:injected})).error?.code,'42501');
    const nested=structuredClone(current);nested.students[0].ownerId=ownerB;
    assert.equal((await a.rpc('commit_classcompass_state',{p_expected_revision:3,p_state:nested})).error?.code,'42501');
    const crossOwner=await a.from('classcompass_students').select('*').eq('owner_id',ownerB);assert.ifError(crossOwner.error);assert.deepEqual(crossOwner.data,[]);
    const writeOther=await a.from('classcompass_students').insert({owner_id:ownerB,id:'forged',position:10,data:{id:'forged',ownerId:ownerB}});assert(writeOther.error);
    const originalVersion=current.planVersions[0];const changeHistory=await a.from('classcompass_plan_versions').update({data:{...originalVersion,snapshot:{...originalVersion.snapshot,title:'Tampered'}}}).eq('owner_id',ownerA).eq('id',originalVersion.id);assert.equal(changeHistory.error?.code,'23514');
    const omit=structuredClone(current);omit.planVersions=[];
    assert.equal((await a.rpc('commit_classcompass_state',{p_expected_revision:3,p_state:omit})).error?.code,'23514');
    assert.equal(((await a.rpc('load_classcompass_state')).data as AppState).revision,3);
    console.log('PASS: owner injection, nested owner injection, cross-owner reads/writes and immutable history tampering fail without partial saves.');
    const ownPath=`${ownerA}/check-${randomUUID()}.json`;paths.push(ownPath);
    assert.ifError((await a.storage.from('classcompass-evidence').upload(ownPath,Buffer.from('{"fictional":true}'),{contentType:'application/json',upsert:false})).error);
    assert.ifError((await a.storage.from('classcompass-evidence').download(ownPath)).error);
    assert((await a.storage.from('classcompass-evidence').update(ownPath,Buffer.from('{"tampered":true}'),{contentType:'application/json'})).error);
    assert((await b.storage.from('classcompass-evidence').download(ownPath)).error);
    assert((await b.storage.from('classcompass-evidence').createSignedUrl(ownPath,60)).error);
    const injectedPath=`${ownerA}/injected-${randomUUID()}.json`;paths.push(injectedPath);
    assert((await b.storage.from('classcompass-evidence').upload(injectedPath,Buffer.from('{}'),{contentType:'application/json'})).error);
    const anonymous=createClient(url,key,clientOptions);
    assert((await anonymous.rpc('load_classcompass_state')).error);
    assert((await anonymous.storage.from('classcompass-evidence').download(ownPath)).error);
    console.log('PASS: private storage reads, signed URLs and uploads enforce owner prefixes; anonymous access is denied.');
    console.log('Supabase verification passed. Temporary identities and storage objects will be removed.');
  } finally {
    if(paths.length){const result=await admin.storage.from('classcompass-evidence').remove(paths);if(result.error)console.error('Cleanup warning: temporary storage objects remain.');}
    for(const client of clients)await client.auth.signOut();
    for(const userId of userIds){const result=await admin.auth.admin.deleteUser(userId);if(result.error)console.error(`Cleanup warning: temporary verification identity ${userId} remains.`);}
  }
}
main().catch(error=>{console.error(`Supabase verification failed: ${error instanceof Error ? error.message : 'unknown error'}`);process.exitCode=1;});
