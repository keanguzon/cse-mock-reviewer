import { adminCall } from './service';
import { serviceClient } from './clients';
import type { AdminContext } from '$lib/admin/types';

export async function runAccountDeletion(context: AdminContext, operationId: string, prepare?: { userId: string; typedEmail: string }) {
  if (prepare) await adminCall('delete_prepare', { ...prepare, operationId }, context);
  const operation = await adminCall('delete_claim', { operationId }, context);
  if (operation.status === 'complete' || operation.claimed === false) return operation;
  const userId = operation.userId ?? operation.targetId;
  if (!userId) throw new Error('Invalid deletion operation.');
  let outcome = 'pending';
  let errorCode: string | undefined;
  try {
    const client = serviceClient();
    const { error: authError } = await client.auth.admin.deleteUser(userId, false);
    if (!authError) outcome = 'complete';
    else {
      const { data, error } = await client.auth.admin.getUserById(userId);
      if (!data.user && (error?.status === 404 || error?.code === 'user_not_found')) outcome = 'complete';
      else { outcome = 'failed'; errorCode = 'AUTH_DELETE_FAILED'; }
    }
  } catch { errorCode = 'AUTH_UNCERTAIN'; }
  return adminCall('delete_finish', { operationId, outcome, errorCode, leaseToken: operation.leaseToken }, context);
}
