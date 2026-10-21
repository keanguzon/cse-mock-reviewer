export async function adminRequest<T = any>(path: string, body?: unknown): Promise<T> {
  const csrf = typeof document === 'undefined' ? '' : decodeURIComponent(document.cookie.split('; ').find(c => c.startsWith('cse_admin_csrf='))?.slice('cse_admin_csrf='.length) ?? '');
  const response = await fetch(`/admin/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) {
    if (response.status === 401) { window.location.assign('/admin/login'); }
    const value = await response.json().catch(() => ({}));
    throw new Error(value.message || 'Request failed. Refresh and retry.');
  }
  return response.json();
}
