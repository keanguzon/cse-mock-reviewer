const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const banks = ['verbal_vocabulary','verbal_grammar','verbal_correct_usage','verbal_vocabulary_filipino','verbal_idyoma_filipino','verbal_balarila_filipino','verbal_pagaunawa_filipino'];
const records = banks.flatMap(name => JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/lib/questions', name + '.json'), 'utf8')));
const q = id => records.find(record => record.id === String(id));
test('assigned language banks retain their counts and one keyed choice', () => {
  assert.equal(records.length, 500);
  for (const record of records) assert.equal(record.choices.filter(choice => choice === record.correct_answer).length, 1, record.id);
});
test('possession, article and comparison tasks supply the required meaning', () => {
  assert.match(q(16014).question, /several employees/);
  assert.match(q(16033).question, /plural possessive/);
  assert.match(q(16020).question, /indefinite article/);
  assert.match(q(15096).question, /more than she likes me/);
  assert.match(q(15051).question, /courteous ordering/);
  assert.match(q(20123).question, /kasalukuyang.*nakagawiang/);
});
test('accepted grammar variants are not competing answers', () => {
  assert.doesNotMatch(q(16050).question, /different from/);
  assert.equal(q(16050).choices.filter(choice => /^His approach is different from mine\.$/.test(choice)).length, 1);
  assert.ok(!q(15059).choices.includes('quantity'));
  assert.ok(!q(15100).choices.includes('to'));
  assert.ok(!q(15002).choices.includes('supplementary'));
  assert.ok(!q(16006).choices.includes('This procedure is more simple than the previous one.'));
  assert.ok(!q(15068).choices.includes('Each of the students has their own laptop.'));
  assert.ok(!q(16001).choices.includes('Each of the employees is required to submit their reports.'));
  assert.match(q(15068).explanation, /Singular.*their.*standard/);
  assert.match(q(15100).explanation, /to.*also standard/);
});
test('completed document sentence uses intransitive lie and transitive lay', () => {
  assert.match(q(16064).question, /is lying on the desk/);
  assert.equal(q(16064).correct_answer, 'laid');
});
test('dictionary senses use explicit Filipino contexts', () => {
  assert.match(q(20072).question, /balatkayo/);
  assert.doesNotMatch(q(20072).question, /balat kayo/);
  assert.equal(q(20072).correct_answer, 'pagkukunwari');
  assert.match(q(20098).question, /basurang hindi nakolekta/);
  assert.match(q(20098).correct_answer, /mabahong amoy/);
  assert.doesNotMatch(q(20098).correct_answer, /mabilis|balita/);
  assert.match(q(20136).explanation, /patinig na u/);
  assert.doesNotMatch(q(20062).correct_answer, /kapalmurahanan/);
});
test('legal passages preserve statutory scope and alternative eligibility routes', () => {
  for (const id of [20160,20161]) {
    assert.match(q(id).question, /open burning/);
    assert.doesNotMatch(q(id).question, /pagsusunog ng basura sa lahat ng lugar/);
  }
  for (const id of [20191,20192]) {
    assert.match(q(id).question, /isang paraan/);
    assert.match(q(id).question, /honor graduate.*bar o board/);
    assert.doesNotMatch(q(id).question, /kailangan ng isang tao na pumasa/);
  }
  assert.doesNotMatch(q(20196).question, /hate speech/);
  assert.match(q(20196).question, /katotohanan.*bago maglathala/);
  assert.match(q(20176).correct_answer, /maharap sa/);
});
