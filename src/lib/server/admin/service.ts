import { error } from '@sveltejs/kit';
import { serviceClient } from './clients';
import type { AdminContext } from '$lib/admin/types';

export async function adminCall(action: string, args: Record<string, unknown>, context: AdminContext): Promise<any> {
  const { data, error: dbError } = await serviceClient().rpc('admin_console', {
    p_action: action, p_args: { ...args, actorId: context.adminId, sessionId: context.sessionId }
  });
  if (dbError) {
    const auditAction = ({ delete_prepare: 'delete_account', delete_claim: 'delete_retry' } as Record<string,string>)[action] ?? action;
    if (['delete_attempts','reset','delete_account','delete_retry','selection'].includes(auditAction)) {
      try {
        await serviceClient().rpc('admin_console', { p_action: 'failure_audit', p_args: {
          actorId: context.adminId, sessionId: context.sessionId, action: auditAction,
          ...(typeof args.userId === 'string' ? { userId: args.userId } : {}),
          ...(typeof args.operationId === 'string' ? { operationId: args.operationId } : {})
        } });
      } catch { /* The original failure remains authoritative when audit storage is unavailable. */ }
    }
    const text = dbError.message || '';
    if (/FORBIDDEN|PROTECTED|REAUTH|EMAIL_MISMATCH/i.test(text)) error(403, 'This action is not permitted. Check the target and reauthenticate.');
    if (/STALE|EXPIRED|CONFLICT|SELECTION/i.test(text)) error(409, 'The selected data changed or the confirmation expired. Refresh and review again.');
    if (/NOT_FOUND/i.test(text)) error(404, 'Record not found.');
    if (/INVALID|LIMIT|PAYLOAD/i.test(text)) error(400, 'Invalid request. Check your selection and filters.');
    error(503, 'Admin database is unavailable or its migration has not been applied. Please retry.');
  }
  return data;
}
