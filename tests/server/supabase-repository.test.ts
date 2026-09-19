import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepository } from '../../lib/server/repository';
import { createInitialState } from '../../lib/domain';
import { legacyState } from '../domain/helpers';
import { CATALOG_VERSION } from '../../lib/assignments';
import { curriculum } from '../../lib/curriculum';

describe('connected repository conflict boundary',()=>{
  it('persists an additive catalog upgrade with the existing owner-scoped compare-and-swap RPC',async()=>{
    const ownerId='11111111-1111-4111-8111-111111111111';let stored=legacyState(ownerId);const originals=structuredClone(stored.planVersions);
    const rpc=vi.fn(async(name:string,args?:{p_expected_revision:number;p_state:typeof stored})=>{
      if(name==='load_classcompass_state')return{data:structuredClone(stored),error:null};
      expect(args!.p_expected_revision).toBe(stored.revision);stored=structuredClone(args!.p_state);return{data:null,error:null};
    });
    const repository=new SupabaseRepository({id:ownerId,name:'Teacher',client:{rpc} as unknown as SupabaseClient});
    const upgraded=await repository.read();expect(upgraded.classroom.catalogVersion).toBe(CATALOG_VERSION);expect(upgraded.plans).toHaveLength(curriculum.lessons.length);expect(upgraded.planVersions.slice(0,2)).toEqual(originals);expect(upgraded.revision).toBe(2);
    expect(await repository.read()).toEqual(upgraded);expect(rpc.mock.calls.filter(call=>call[0]==='commit_classcompass_state')).toHaveLength(1);
  });
  it('reloads a winning concurrent catalog migration without replaying the caller operation',async()=>{
    const ownerId='11111111-1111-4111-8111-111111111111',old=legacyState(ownerId),winner=createInitialState(ownerId);winner.revision=2;winner.classroom.name='Concurrent save';
    const rpc=vi.fn().mockResolvedValueOnce({data:old,error:null}).mockResolvedValueOnce({data:null,error:{code:'PT409'}}).mockResolvedValueOnce({data:structuredClone(winner),error:null}).mockResolvedValueOnce({data:null,error:null});
    const operation=vi.fn((state:typeof winner)=>{state.classroom.name+=' plus operation';});
    const repository=new SupabaseRepository({id:ownerId,name:'Teacher',client:{rpc} as unknown as SupabaseClient});await repository.transact(operation);
    expect(operation).toHaveBeenCalledTimes(1);expect(rpc.mock.calls[3][1].p_expected_revision).toBe(2);expect(rpc.mock.calls[3][1].p_state.classroom.name).toBe('Concurrent save plus operation');
  });
  it.each(['PT409','40001'])('maps %s to a recoverable 409 without retrying the mutation',async code=>{
    const ownerId='11111111-1111-4111-8111-111111111111';
    const stored=createInitialState(ownerId);
    const rpc=vi.fn().mockResolvedValueOnce({data:structuredClone(stored),error:null}).mockResolvedValueOnce({data:null,error:{code,message:'Deliberate version conflict'}});
    const repository=new SupabaseRepository({id:ownerId,name:'Teacher',client:{rpc} as unknown as SupabaseClient});
    await expect(repository.transact(state=>{state.classroom.name='Attempted update';})).rejects.toMatchObject({code:'REVISION_CONFLICT',status:409});
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1][0]).toBe('commit_classcompass_state');
    expect(rpc.mock.calls[1][1].p_expected_revision).toBe(1);
    expect(rpc.mock.calls[1][1].p_state.revision).toBe(2);
    expect(stored.classroom.name).not.toBe('Attempted update');
  });
});
