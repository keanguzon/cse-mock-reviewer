const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'docs/content', name + '.json'), 'utf8'));
test('all 84 historical cue candidates have a final editorial disposition', () => {
  const original = read('2026-10-21-question-bank-recheck').cue_candidates;
  const final = [
    ...read('cue-final-reasoning').items,
    ...read('cue-final-facts').dispositions,
    ...read('cue-final-language').cue_review,
    ...read('cue-final-followup').changes
  ];
  const ids = new Set(final.map(x => x.id));
  assert.equal(original.length, 84);
  for (const item of original) assert.ok(ids.has(item.id), `Missing disposition: ${item.id}`);
  for (const item of final) assert.ok(item.reason.length > 20, item.id);
});
test('follow-up choices preserve the precise legal key without isolated formatting clues', () => {
  const followup = read('cue-final-followup');
  for (const item of followup.changes) {
    const bank = JSON.parse(fs.readFileSync(path.join(root, item.file), 'utf8'));
    assert.deepEqual(bank.find(q => q.id === item.id), item.after);
  }
  const saln = followup.changes.find(x => x.id === '7105').after;
  assert.ok(saln.choices.every(x => /^[A-Z]{3,4}$/.test(x)));
  assert.equal(saln.correct_answer, 'SALN');
  assert.match(saln.explanation, /Statement of Assets, Liabilities and Net Worth/);
});
