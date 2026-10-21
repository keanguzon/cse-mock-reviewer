import { describe, it, expect } from 'vitest';
import { toggleRow, togglePage, emptySelection } from '../../src/lib/admin/selection';
describe('admin selection', () => {
  it('selects the visible page without broadening selection', () => {
    const s = togglePage(emptySelection(), ['a','b']);
    expect(s.ids).toEqual(['a','b']);
    expect(togglePage(s, ['a','b']).ids).toEqual([]);
  });
  it('preserves other-page IDs and clears stale seals when changed', () => {
    const s = toggleRow({ids:['a'],selectionId:'sealed'}, 'b');
    expect(s).toEqual({ids:['a','b'],selectionId:null});
    expect(toggleRow(s,'a').ids).toEqual(['b']);
  });
});
