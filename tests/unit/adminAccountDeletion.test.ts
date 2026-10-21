import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(()=>({call:vi.fn(),remove:vi.fn(),get:vi.fn()}));
vi.mock('../../src/lib/server/admin/service',()=>({adminCall:mocks.call}));
vi.mock('../../src/lib/server/admin/clients',()=>({serviceClient:()=>({auth:{admin:{deleteUser:mocks.remove,getUserById:mocks.get}}})}));
import { runAccountDeletion } from '../../src/lib/server/admin/accountDeletion';
const context={adminId:'admin',sessionId:'session',reauthenticatedAt:'now'};
describe('account deletion coordinator',()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.call.mockImplementation(async(action)=>action==='delete_claim'?{userId:'target',claimed:true,leaseToken:'lease',status:'auth_delete_pending'}:{status:'complete'});mocks.remove.mockResolvedValue({error:null});});
 it('commits prepare before Auth and threads the claim lease to finalization',async()=>{
  await runAccountDeletion(context,'op',{userId:'target',typedEmail:'target@example.test'});
  expect(mocks.call.mock.calls.map(c=>c[0])).toEqual(['delete_prepare','delete_claim','delete_finish']);
  expect(mocks.remove).toHaveBeenCalledWith('target',false);
  expect(mocks.call.mock.calls[2][1]).toMatchObject({leaseToken:'lease',outcome:'complete'});
 });
 it('never calls Auth when preparation fails',async()=>{mocks.call.mockRejectedValueOnce(Error('database'));await expect(runAccountDeletion(context,'op',{userId:'target',typedEmail:'x'})).rejects.toThrow();expect(mocks.remove).not.toHaveBeenCalled();});
 it('does not execute another worker claim',async()=>{mocks.call.mockResolvedValue({claimed:false,status:'auth_delete_pending'});await runAccountDeletion(context,'op');expect(mocks.remove).not.toHaveBeenCalled();});
 it('records uncertain transport outcome without claiming account absence',async()=>{mocks.remove.mockRejectedValue(Error('network'));await runAccountDeletion(context,'op');expect(mocks.call.mock.calls.at(-1)?.[1]).toMatchObject({outcome:'pending',errorCode:'AUTH_UNCERTAIN'});});
 it('reconciles an already absent Auth account',async()=>{mocks.remove.mockResolvedValue({error:{status:404}});mocks.get.mockResolvedValue({data:{user:null},error:{status:404}});await runAccountDeletion(context,'op');expect(mocks.call.mock.calls.at(-1)?.[1].outcome).toBe('complete');});
});
