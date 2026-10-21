import { error, fail, isHttpError, redirect } from '@sveltejs/kit';
import { issueLoginNonce, loginAdmin } from '$lib/server/admin/session';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => ({ csrf: issueLoginNonce(event) });

export const actions: Actions = {
  default: async (event) => {
    try {
      const type = event.request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (type !== 'application/x-www-form-urlencoded' && type !== 'multipart/form-data') error(415, 'Unsupported request content type.');
      const form = await event.request.clone().formData();
      const email = form.get('email'); const password = form.get('password');
      await loginAdmin(event, typeof email === 'string' ? email : '', typeof password === 'string' ? password : '');
    } catch (cause) {
      if (!isHttpError(cause)) throw cause;
      return fail(cause.status, { message: cause.body.message, csrf: issueLoginNonce(event) });
    }
    redirect(303, '/admin');
  }
};
