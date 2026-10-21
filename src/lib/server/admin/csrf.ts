import { error, type RequestEvent } from '@sveltejs/kit';
import { equalTokens, hashToken } from './crypto';

export async function mutationToken(event: RequestEvent, origin: string): Promise<string> {
  if (event.request.method !== 'POST') error(405, 'Method not allowed.');
  if (event.request.headers.get('origin') !== origin || event.url.origin !== origin) error(403, 'Request rejected.');
  const type = event.request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (type !== 'application/json' && type !== 'application/x-www-form-urlencoded' && type !== 'multipart/form-data') error(415, 'Unsupported request content type.');
  const header = event.request.headers.get('x-csrf-token');
  if (header) return header;
  if (type === 'application/x-www-form-urlencoded' || type === 'multipart/form-data') {
    const form = await event.request.clone().formData();
    const token = form.get('csrf');
    if (typeof token === 'string' && token.length <= 256) return token;
  }
  error(403, 'Request rejected.');
}

export function verifyCsrf(token: string, hash: string) {
  if (!token || token.length > 256 || !equalTokens(hashToken(token), hash)) error(403, 'Request rejected.');
}
