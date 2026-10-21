const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const names = ['general_info_constitution', 'general_info_current_events', 'verbal_reading_comprehension', 'verbal_paragraph_org'];
const banks = Object.fromEntries(names.map(name => [name, JSON.parse(fs.readFileSync(path.join(root, 'src/lib/questions', name + '.json'), 'utf8'))]));
const ledger = require('../../docs/content/corrections-facts.json');
const byId = id => Object.values(banks).flat().find(q => q.id === String(id));
const sentences = q => q.question.split('\n\n')[1].split('\n').map(line => line.slice(3));
const resolve = (sequence, blocks) => sequence.split('-').map(label => blocks['ABCD'.indexOf(label)]);

test('all 50 paragraph permutations preserve the original semantic paths for every option', () => {
  assert.equal(ledger.paragraph_mapping_invariants.length, 50);
  const sequences = new Set();
  for (const fixture of ledger.paragraph_mapping_invariants) {
    const q = byId(fixture.id);
    const blocks = sentences(q);
    assert.deepEqual([...blocks].sort(), [...fixture.old_sentences].sort(), fixture.id + ' sentence preservation');
    assert.notEqual(q.correct_answer, 'A-B-C-D', fixture.id + ' displayed order must not give away the answer');
    assert.equal(q.choices.length, fixture.old_choices.length);
    q.choices.forEach((choice, index) => {
      assert.deepEqual(choice.split('-').sort(), ['A', 'B', 'C', 'D'], fixture.id + ' valid permutation');
      assert.deepEqual(resolve(choice, blocks), resolve(fixture.old_choices[index], fixture.old_sentences), fixture.id + ' distractor semantics');
    });
    assert.deepEqual(resolve(q.correct_answer, blocks), resolve(fixture.old_answer, fixture.old_sentences), fixture.id + ' correct paragraph semantics');
    assert.equal(q.choices.filter(choice => choice === q.correct_answer).length, 1);
    const labels = Object.fromEntries([...fixture.display_order].map((old, index) => [old, 'ABCD'[index]]));
    assert.equal(q.explanation, fixture.old_explanation.replace(/\b[ABCD]\b/g, label => labels[label]), fixture.id + ' explanation references');
    sequences.add(q.correct_answer);
  }
  assert.ok(sequences.size >= 6, 'paragraph keys use multiple coherent permutations');
});

test('legal passages retain the qualifications that distinguish the prohibited or required conduct', () => {
  for (const id of [18014, 18015, 18074]) assert.match(byId(id).question, /poisonous and toxic fumes/);
  for (const id of [18014, 18074]) assert.match(byId(id).correct_answer, /poisonous and toxic fumes/);
  assert.match(byId(18062).question, /lawful basis/);
  assert.match(byId(18062).question, /contractual necessity/);
  assert.doesNotMatch(byId(18062).question, /must obtain explicit consent/);
  assert.match(byId(7083).question, /regional director.*salary grade 27.*more than one million pesos/);
  assert.match(byId(7089).correct_answer, /voting separately/);
  assert.match(byId(7093).question, /co-production, joint-venture, or production-sharing/);
  assert.match(byId(7105).explanation, /excepts honorary officials, laborers, and casual or temporary workers/);
  assert.match(byId(17045).question, /resignation.*thirty days.*divestment.*sixty days/);
});

test('scientific reading rewrites avoid universal diets and guaranteed medical outcomes', () => {
  assert.match(byId(18061).question, /Leatherback sea turtles/);
  assert.doesNotMatch(byId(18061).question, /their primary food source/);
  assert.match(byId(18063).question, /effects vary/);
  assert.doesNotMatch(byId(18063).question, /ten minutes daily reduces cortisol/i);
  assert.doesNotMatch(byId(17088).question, /visible from low Earth orbit/);
});

test('answer annotations no longer supply names or geography directly', () => {
  for (const id of [8006, 8047, 8049]) assert.ok(byId(id).choices.every(choice => !/[()]/.test(choice)));
  assert.match(byId(8003).question, /June 2024/);
  assert.equal(Number(byId(8003).correct_answer), 17 + 1);
  assert.match(byId(8061).question, /adopted in 2015/);
});
