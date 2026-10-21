const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const names = ['general_info_constitution', 'general_info_current_events', 'verbal_reading_comprehension', 'verbal_paragraph_org'];
const banks = names.map(name => JSON.parse(fs.readFileSync(path.join(root, 'src/lib/questions', name + '.json'), 'utf8')));
const all = banks.flat();
const byId = id => all.find(q => q.id === String(id));
const ledger = require('../../docs/content/cue-final-facts.json');
const historical = require('../../docs/content/corrections-facts.json');

test('every historical factual cue candidate has a final reasoned disposition', () => {
  const reviewed = new Map(ledger.dispositions.map(x => [x.id, x]));
  assert.equal(reviewed.size, 49);
  for (const old of historical.remaining_unresolved) {
    const entry = reviewed.get(old.id);
    assert.ok(entry, old.id);
    assert.ok(['revised', 'retained_after_review'].includes(entry.status), old.id);
    assert.ok(entry.reason.length > 50, old.id);
    assert.equal(entry.correct_answer, byId(old.id).correct_answer);
  }
});

test('reviewed alternatives remain distinct and contain exactly one keyed answer', () => {
  for (const entry of ledger.dispositions) {
    const q = byId(entry.id);
    assert.equal(q.choices.length, 4, entry.id);
    assert.equal(new Set(q.choices.map(x => x.trim().toLowerCase())).size, 4, entry.id);
    assert.equal(q.choices.filter(x => x === q.correct_answer).length, 1, entry.id);
  }
  assert.deepEqual(banks.map(b => b.length), [100, 100, 100, 100]);
});

test('strong name and acronym leaks are removed without removing the subject knowledge', () => {
  const rizal = byId(8006);
  assert.match(rizal.question, /Noli Me Tangere and El Filibusterismo/);
  assert.doesNotMatch(rizal.question, /Rizal/);
  assert.equal(rizal.correct_answer, 'Jose Rizal');
  assert.ok(rizal.choices.every(x => x.split(/\s+/).length >= 2));
  for (const id of [8084, 8093, 8098, 8100]) {
    assert.ok(byId(id).choices.every(x => /\([^)]+\)/.test(x)), String(id));
  }
  assert.ok(byId(8084).choices.every(x => x.length > 30));
  assert.ok(byId(8098).choices.every(x => x.length > 30));
});

test('Basel key describes controlled movement rather than an absolute directional ban', () => {
  assert.match(byId(8073).correct_answer, /Controlling and minimizing transboundary movements/);
  assert.match(byId(8073).explanation, /does not impose a blanket ban/);
  assert.doesNotMatch(byId(8073).correct_answer, /developed to developing/);
});

test('reading distractors avoid the former absurd answer-elimination clues', () => {
  const removed = {18052: /dislike cleaner|zero carbon/, 18054: /freshwater rivers|immediately double/, 18068: /harmless water droplets|twice their normal size/, 18076: /eliminates the need for water|completely replaces rural farms/, 18079: /migrate onto land|into freshwater/, 18090: /learn Latin/, 18098: /ocean currents flowing through city streets|complete lack of sunshine/, 18100: /banning online shopping/};
  for (const [id, pattern] of Object.entries(removed)) assert.doesNotMatch(byId(id).choices.join(' '), pattern, id);
});
