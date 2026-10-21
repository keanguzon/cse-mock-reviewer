import { describe, expect, it } from 'vitest';
import { readLocalSession, storeLocalSession, clearLocalSession } from '../../src/lib/activeSession';
const question = { id: 'q', question: 'Q', category: 'Verbal', choices: ['a','b','c','d'], correct_answer: 'a' };
function memory() {
 const values = new Map<string,string>();
 return { values, getItem: (k:string) => values.get(k) ?? null, setItem: (k:string,v:string) => { values.set(k,v); }, removeItem: (k:string) => { values.delete(k); } };
}
describe('owner-scoped paused exams', () => {
 it('keeps owners and guest separate and rejects a reset generation', () => {
  const storage = memory(); const snapshot = { version: 2 as const, ownerId:'a', generation:0, sessionId:'id', questions:[question], currentIndex:0, userAnswers:{}, mode:'practice', category:'Verbal', level:'professional', elapsedSeconds:5, durationSeconds:0 };
  storeLocalSession(storage,snapshot);
  expect(readLocalSession(storage,'b',0)).toBeNull();
  expect(readLocalSession(storage,'a',1)).toBeNull();
  expect(readLocalSession(storage,'a',0)?.sessionId).toBe('id');
  clearLocalSession(storage,'b'); expect(readLocalSession(storage,'a',0)).not.toBeNull();
 });
 it('quarantines the unknown-owner legacy key instead of assigning it', () => {
  const storage = memory(); storage.setItem('cse_active_session',JSON.stringify({ questions:[question] }));
  expect(readLocalSession(storage,'a',0)).toBeNull();
  expect(storage.getItem('cse_active_session')).toBeNull();
  expect(storage.getItem('cse_active_session:quarantine')).not.toBeNull();
 });
});
