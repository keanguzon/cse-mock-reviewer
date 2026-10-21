const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('maintenance imports have no side effects', () => {
  const root = path.resolve(__dirname, '../..');
  // A fixture working directory alone is insufficient because old scripts use __dirname.
  const result = spawnSync(process.execPath, ['-e', `const fs=require('node:fs'); fs.writeFileSync=()=>{throw Error('import wrote a file')}; require('./fix_logic_bias.cjs'); require('./scripts/add_10_new_gen_info.cjs');`], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});

test('Roman conclusion labels swap once, including standalone and repeated labels', () => {
  const fs = require('node:fs');
  if (!fs.readFileSync(path.resolve(__dirname, '../../fix_logic_bias.cjs'), 'utf8').includes('require.main === module')) return assert.fail('missing import guard');
  const module = require('../../fix_logic_bias.cjs');
  assert.equal(typeof module.swapConclusionLabels, 'function');
  const original = 'Conclusion I follows; conclusion II does not. (I) and (II). I, II, III.';
  assert.equal(module.swapConclusionLabels(original), 'Conclusion II follows; conclusion I does not. (II) and (I). II, I, III.');
  assert.equal(module.swapConclusionLabels(module.swapConclusionLabels(original)), original);
});

test('adding fixed-ID seed questions twice is idempotent and preserves existing records', () => {
  const fs = require('node:fs');
  if (!fs.readFileSync(path.resolve(__dirname, '../../scripts/add_10_new_gen_info.cjs'), 'utf8').includes('require.main === module')) return assert.fail('missing import guard');
  const module = require('../../scripts/add_10_new_gen_info.cjs');
  assert.equal(typeof module.appendUniqueQuestions, 'function');
  const existing = [{ id: 'original', question: 'Keep this' }, { id: '7101', question: 'Existing snapshot' }];
  const incoming = Array.from({ length: 10 }, (_, index) => ({ id: String(7101 + index), question: 'Seed' }));
  const once = module.appendUniqueQuestions(existing, incoming);
  const twice = module.appendUniqueQuestions(once, incoming);
  assert.equal(once.length, 11);
  assert.deepEqual(twice, once);
  assert.deepEqual(existing, [{ id: 'original', question: 'Keep this' }, { id: '7101', question: 'Existing snapshot' }]);
  assert.equal(once.find(question => question.id === '7101').question, 'Existing snapshot');
  assert.equal(new Set(once.map(question => question.id)).size, 11);
  assert.equal(module.newQuestions.find(question => question.id === '7107').explanation.includes('Section 4(d)'), true);
});
