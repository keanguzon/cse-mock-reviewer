export type Selection = { ids: string[]; selectionId: string | null };
export const emptySelection = (): Selection => ({ ids: [], selectionId: null });
export function toggleRow(state: Selection, id: string): Selection {
  return { ids: state.ids.includes(id) ? state.ids.filter(value => value !== id) : [...state.ids, id], selectionId: null };
}
export function togglePage(state: Selection, ids: string[]): Selection {
  const all = ids.every(id => state.ids.includes(id));
  return { ids: all ? state.ids.filter(id => !ids.includes(id)) : [...new Set([...state.ids, ...ids])], selectionId: null };
}
