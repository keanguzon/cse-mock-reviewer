const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../..');
const load = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const report = load('docs/content/cue-final-language.json');
const names = ['verbal_vocabulary','verbal_grammar','verbal_correct_usage','verbal_vocabulary_filipino','verbal_idyoma_filipino','verbal_balarila_filipino','verbal_pagaunawa_filipino'];
const records = names.flatMap(name => load(`src/lib/questions/${name}.json`));
const q = id => records.find(record => record.id === String(id));

test('five unresolved idioms have contextual, source-backed resolutions', () => {
  assert.deepEqual(report.idiom_resolutions.map(x => x.id), ['20058','20059','20064','20079','20092']);
  assert.deepEqual(report.pending, []);
  for (const entry of report.idiom_resolutions) {
    assert.ok(entry.primary_sources.length > 0, entry.id);
    assert.match(q(entry.id).question, /sa pangungusap/);
    assert.equal(q(entry.id).choices.filter(x => x === q(entry.id).correct_answer).length, 1);
  }
  assert.equal(q(20058).correct_answer, 'magnanakaw ng gamit');
  assert.equal(q(20059).correct_answer, 'banayad humawak');
  assert.match(q(20059).question, /paghawak sa sanggol/);
  assert.doesNotMatch(q(20059).explanation, /masipag, mahusay/);
  for (const id of [20064,20079,20092]) {
    assert.doesNotMatch(q(id).question + q(id).explanation, /naglalagay ng bunga sa bibig|mahabang dulang|koneksyon sa langit|koneksyon sa kalikasan/);
  }
});

test('editorial review resolves all 21 named language cue candidates', () => {
  const expected = load('docs/content/corrections-language.json').cue_review.map(x => x.id).sort();
  assert.deepEqual(report.cue_review.map(x => x.id).sort(), expected);
  assert.equal(new Set(report.cue_review.map(x => x.id)).size, 21);
  for (const entry of report.cue_review) {
    assert.ok(['rewritten','retained','retained_choices'].includes(entry.status), entry.id);
    assert.ok(entry.reason.length > 60, entry.id);
  }
  for (const id of [20055,20066,20068,20070,20075,20087,20093,20096,20097,20100]) {
    assert.doesNotMatch(q(id).choices.join(' '), /mahilig sa manok|piloto ng eroplano|mahilig lumipad|mahilig kumain|nagpapaligo sa init|may sira ang pantalon|mahilig sa matamis na pagkain|may sakit sa tiyan|huwag magtapon ng bato/);
  }
  assert.ok(q(16083).question.includes(q(16083).correct_answer));
  assert.equal(q(20098).choices.filter(x => x.startsWith('naglalabas ng ')).length, 4);
});

test('proverb questions avoid invalid absolute or truth-by-reaction claims', () => {
  assert.doesNotMatch(q(20061).correct_answer + q(20061).explanation, /wala nang magagawa|huli na ang lahat/);
  assert.equal(q(20100).correct_answer, 'pakiusap na huwag personalin ang pangkalahatang puna');
  assert.match(q(20100).explanation, /hindi patunay na totoo/);
  assert.notEqual(q(20100).correct_answer, 'patunay na totoo ang puna kapag may nagalit');
});

test('shared mental-health passage states a statutory aim without claiming achieved universal coverage', () => {
  for (const id of [20199,20200]) {
    assert.match(q(id).question, /Layunin ng Republic Act No\. 11036/);
    assert.doesNotMatch(q(id).question, /nagtitiyak na.*naabot ng lahat/);
  }
  assert.equal(q(20199).choices.filter(x => x.startsWith('Palawakin ang ')).length, 4);
  assert.equal(q(20200).correct_answer, 'Stress, anxiety, at depression');
});

test('language bank identities, counts, and keyed choice uniqueness survive edits', () => {
  assert.equal(records.length, 500);
  assert.equal(new Set(records.map(x => x.id)).size, 500);
  for (const record of records) {
    assert.equal(record.choices.length, 4, record.id);
    assert.equal(new Set(record.choices).size, 4, record.id);
    assert.equal(record.choices.filter(x => x === record.correct_answer).length, 1, record.id);
  }
});
