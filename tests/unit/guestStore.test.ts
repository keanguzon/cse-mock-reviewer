import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { compileModule } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';
const source = ts.transpile(readFileSync(new URL('../../src/lib/guestStore.svelte.ts', import.meta.url), 'utf8'), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
const compiled = compileModule(source, { filename: 'guestStore.svelte.js', generate: 'client' }).js.code.replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '').replace('export const guestStore', 'const guestStore');
function setup(fail = false) {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { if (fail) throw Error('quota'); values.set(key, value); } };
  const cells = { state: (value: unknown) => ({ value }), get: (cell: any) => cell.value, set: (cell: any, value: unknown) => cell.value = value, proxy: (value: unknown) => value };
  const store = new Function('$', 'browser', 'localStorage', compiled + '; return guestStore;')(cells, true, storage);
  return { store, values };
}
const attempt = { score: 1, total: 1, category: 'Mixed Categories', mode: 'practice', level: 'professional' };
const identity = { id: 'stable-id', completed_at: '2026-10-21T00:00:00Z' };
describe('guest result persistence', () => {
  it('retains one result and original completion identity on remount', () => {
    const { store } = setup(); store.save(attempt, identity); store.save(attempt, identity);
    expect(store.attempts).toHaveLength(1); expect(store.attempts[0]).toMatchObject(identity);
  });
  it('surfaces a storage failure without claiming an in-memory save', () => {
    const { store } = setup(true);
    expect(() => store.save(attempt, identity)).toThrow('quota'); expect(store.attempts).toHaveLength(0);
  });
});
