import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), getCsrf: vi.fn() }));
vi.mock('../../src/lib/server/admin/session', () => mocks);
import { load } from '../../src/routes/admin/+layout.server';

function event(path: string) {
  let untracked = false;
  const value = {
    locals: { admin: { adminId: 'actor', sessionId: 'session', reauthenticatedAt: null } },
    depends: vi.fn(),
    untrack<T>(callback: () => T) { untracked = true; try { return callback(); } finally { untracked = false; } },
    get url() {
      if (!untracked) throw new Error('URL dependency would rerun the admin layout on every page change');
      return new URL(`https://reviewer.example${path}`);
    }
  };
  return value;
}

describe('persistent admin layout', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.getCsrf.mockResolvedValue('csrf'); });
  it('does not track child-page URLs and reuses the identity verified by the request hook', async () => {
    const e = event('/admin/users');
    const result = await load(e as unknown as Parameters<typeof load>[0]);
    expect(result).toMatchObject({ admin: { id: 'actor' }, csrf: 'csrf' });
    expect(e.depends).toHaveBeenCalledWith('admin:session');
    expect(mocks.requireAdmin).not.toHaveBeenCalled();
    expect(mocks.getCsrf).toHaveBeenCalledOnce();
  });
  it('keeps the login page public without reading private session data', async () => {
    expect(await load(event('/admin/login') as unknown as Parameters<typeof load>[0])).toEqual({ admin: null });
    expect(mocks.requireAdmin).not.toHaveBeenCalled();
    expect(mocks.getCsrf).not.toHaveBeenCalled();
  });
});
