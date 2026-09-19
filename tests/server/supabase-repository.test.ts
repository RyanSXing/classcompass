import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRepository } from '../../lib/server/repository';
import { createInitialState } from '../../lib/domain';

describe('connected repository conflict boundary',()=>{
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
