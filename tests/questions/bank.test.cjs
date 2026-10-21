const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const bankDir = path.join(root, 'src/lib/questions');
const files = fs.readdirSync(bankDir).filter(name => name.endsWith('.json')).map(name => ({ name, questions: JSON.parse(fs.readFileSync(path.join(bankDir, name), 'utf8')) }));
const baseline = require('./baseline.json');
const byId = id => files.flatMap(file => file.questions).find(question => question.id === id);
const fixture = id => ({ id, category: 'Category', question: 'Question?', choices: ['A', 'B', 'C', 'D'], correct_answer: 'A', explanation: 'Reason.' });
const validate = (...args) => {
  const module = require('../../validate_questions.cjs');
  assert.equal(typeof module.validateQuestionBank, 'function');
  return module.validateQuestionBank(...args);
};

test('validator imports without running the CLI or writing files', () => {
  const result = spawnSync(process.execPath, ['-e', "const m=require('./validate_questions.cjs'); console.log(typeof m.validateQuestionBank)"], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), 'function');
});

test('accepts the explicit 50/75/100 count manifest', () => {
  const sizes = [50, 75, 100];
  const counts = Object.fromEntries(sizes.map(size => [size + '.json', size]));
  const input = sizes.map(size => ({ name: size + '.json', questions: Array.from({ length: size }, (_, index) => fixture(`${size}-${index}`)) }));
  assert.deepEqual(validate(input, counts), { errors: [], total: 225 });
});

for (const [name, change] of [
  ['wrong top-level type', () => ({})],
  ['nonobject question', () => [null]],
  ['empty required string', () => [{ ...fixture('1'), explanation: ' ' }]],
  ['wrong required type', () => [{ ...fixture('1'), id: 1 }]],
  ['duplicate choices', () => [{ ...fixture('1'), choices: ['A', 'A', 'C', 'D'] }]],
  ['key absent from choices', () => [{ ...fixture('1'), correct_answer: 'E' }]],
  ['nonstring choice', () => [{ ...fixture('1'), choices: ['A', 'B', 'C', 4] }]],
  ['incorrect choice count', () => [{ ...fixture('1'), choices: ['A', 'B', 'C'] }]],
  ['wrong file count', () => []]
]) test(`rejects ${name}`, () => assert.ok(validate([{ name: 'fixture.json', questions: change() }], { 'fixture.json': 1 }).errors.length));

test('rejects duplicate IDs across files and missing/unexpected files', () => {
  assert.ok(validate(['a', 'b'].map(name => ({ name, questions: [fixture('same')] })), { a: 1, b: 1 }).errors.some(error => /duplicate.*id/i.test(error)));
  assert.ok(validate([{ name: 'other', questions: [fixture('1')] }], { expected: 1 }).errors.length);
});

test('CLI fixture directory returns exit 1 for duplicate IDs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cse-bank-'));
  try {
    fs.writeFileSync(path.join(dir, 'analytical_analogy.json'), JSON.stringify(Array.from({ length: 100 }, (_, index) => fixture(index < 2 ? 'duplicate' : String(index)))));
    const result = spawnSync(process.execPath, [path.join(root, 'validate_questions.cjs'), '--dir', dir], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stdout + result.stderr, /duplicate.*id/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('preserves every original ID, category, and per-file count', () => {
  assert.deepEqual(files.map(({ name, questions }) => ({ name, records: questions.map(({ id, category }) => ({ id, category })) })), baseline);
  assert.deepEqual(validate(files, Object.fromEntries(baseline.map(file => [file.name, file.records.length]))), { errors: [], total: 1850 });
});

for (const [id, expected] of Object.entries(require('./corrections.json'))) test(`correction ${id}`, () => {
  const question = byId(id);
  assert.ok(question, `missing ${id}`);
  assert.equal(question.correct_answer, expected.answer);
  for (const text of expected.questionIncludes || []) assert.ok(question.question.includes(text), `stem must include ${text}`);
  for (const text of expected.explanationIncludes || []) assert.ok(question.explanation.includes(text), `explanation must include ${text}`);
  for (const text of expected.excludes || []) assert.ok(!JSON.stringify(question).includes(text), `remove ${text}`);
});

test('ledger accounts honestly for every bank ID', () => {
  const ledger = require('../../docs/content/question-review.json');
  assert.deepEqual(Object.keys(ledger).sort(), files.flatMap(file => file.questions.map(question => question.id)).sort());
  for (const { name, questions } of files) for (const question of questions) {
    const entry = ledger[question.id];
    assert.equal(entry.file, name);
    assert.ok(['corrected', 'verified', 'needs_review'].includes(entry.status));
    for (const field of ['reviewed_at', 'method', 'reason']) assert.equal(typeof entry[field], 'string');
    assert.ok(Array.isArray(entry.source_urls));
    if (require('./corrections.json')[question.id]) assert.equal(entry.status, 'corrected');
  }
});

module.exports = { byId };
