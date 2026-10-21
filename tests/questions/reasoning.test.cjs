const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateArithmetic } = require('./arithmetic.cjs');
const read = name => JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/lib/questions', name), 'utf8'));
const byId = id => ['analytical_assumptions.json', 'numerical_age_problems.json', 'numerical_work_problems.json', 'numerical_fractions.json', 'clerical_spelling.json'].flatMap(read).find(question => question.id === id);
function permutations(values) {
  if (!values.length) return [[]];
  return values.flatMap((value, index) => permutations(values.filter((_, i) => i !== index)).map(rest => [value, ...rest]));
}

test('restricted arithmetic parser respects precedence and rejects executable input', () => {
  assert.equal(evaluateArithmetic('3 + 2 × (5 - 1)^2'), 35);
  assert.equal(evaluateArithmetic('18 ÷ 3 × 2'), 12);
  assert.equal(evaluateArithmetic('2^3^2'), 512);
  assert.throws(() => evaluateArithmetic('process.exit(1)'));
});
for (const question of read('numerical_pemdas.json')) test(`independent PEMDAS calculation ${question.id}`, () => {
  const result = evaluateArithmetic(question.question.replace(/^Evaluate:\s*/, ''));
  assert.equal(Number(question.correct_answer), result);
  assert.equal(question.choices.filter(choice => Number(choice) === result).length, 1);
});

test('2024 circle has one arrangement after fixing A, with E at its left', () => {
  assert.match(byId('2024').question, /E sits immediately to the left of A/);
  const solutions = permutations(['B', 'C', 'D', 'E', 'F']).map(rest => ['A', ...rest]).filter(seats => {
    const at = name => seats.indexOf(name);
    return at('D') === 3 && at('B') === 5 && at('E') === 1 && (at('C') + 1) % 6 === at('B') && (at('C') + 5) % 6 === at('D');
  });
  assert.deepEqual(solutions, [['A', 'E', 'F', 'D', 'C', 'B']]);
  assert.equal(byId('2024').correct_answer, solutions[0][1]);
});

test('2033 committees exist and require only the listed E/F pair', () => {
  assert.match(byId('2033').question, /A and B cannot both be chosen/);
  const committees = permutations(['A', 'B', 'C', 'D', 'E', 'F']).map(values => values.slice(0, 4).sort().join(''));
  const solutions = [...new Set(committees)].filter(group => group.includes('C') && group.includes('E') && group.includes('F') && !group.includes('D') && !(group.includes('A') && group.includes('B')));
  assert.deepEqual(solutions.sort(), ['ACEF', 'BCEF']);
  assert.equal(byId('2033').correct_answer, 'E and F');
});

test('2051 facing-center circle has one arrangement and E on B left', () => {
  assert.match(byId('2051').question, /E is adjacent to D/);
  const solutions = permutations(['A', 'C', 'D', 'E']).map(rest => ['B', ...rest]).filter(seats => {
    const at = name => seats.indexOf(name);
    const adjacent = (a, b) => [1, 4].includes((at(a) - at(b) + 5) % 5);
    return at('A') === 4 && adjacent('C', 'A') && adjacent('C', 'D') && adjacent('E', 'D');
  });
  assert.deepEqual(solutions, [['B', 'E', 'D', 'C', 'A']]);
  assert.equal(byId('2051').correct_answer, solutions[0][1]);
});

test('2063 module order and 2071 highway order are unique', () => {
  assert.match(byId('2063').question, /immediately after Module 3/);
  const modules = permutations([1, 2, 3, 4]).filter(order => order[0] === 3 && order[1] === 1 && order.indexOf(2) < order.indexOf(4));
  assert.deepEqual(modules, [[3, 1, 2, 4]]);
  assert.equal(byId('2063').correct_answer, 'Module ' + modules[0][3]);
  assert.match(byId('2071').question, /B1 is to the left of B2/);
  const roads = permutations([1, 2, 3, 4, 5]).filter(order => {
    const at = name => order.indexOf(name);
    return at(1) < at(3) && at(3) < at(2) && at(2) < at(4) && at(5) < at(1);
  });
  assert.deepEqual(roads, [[5, 1, 3, 2, 4]]);
  assert.equal(byId('2071').correct_answer, 'B' + roads[0][2]);
});

test('9068 mother age satisfies both independently solved constraints', () => {
  const mother = Number.parseFloat(byId('9068').correct_answer);
  const daughter = (mother + 10) / 2 - 10;
  assert.equal(mother - 10, 6 * (daughter - 10));
  assert.equal(mother, 40);
});
test('14061 states which alternating tap starts', () => assert.match(byId('14061').question, /starting with B/));
test('14022 and 14058 explicitly request the rounding used by their keys', () => {
  assert.match(byId('14022').question, /nearest minute/);
  assert.match(byId('14058').question, /two decimal places/);
  assert.equal(Math.round(60 / (1 / 3 + 1 / 4)), 103);
  assert.equal((20 / 0.75).toFixed(2), '26.67');
});
test('equivalent fraction distractors require simplest form in 10014 and 10019', () => {
  for (const id of ['10014', '10019']) assert.match(byId(id).question, /simplest form/);
  assert.equal(evaluateArithmetic('4/9 * 3/2'), 2/3);
  assert.equal(evaluateArithmetic('(5/12)/(5/6)'), 1/2);
});
test('6018 misspelling is tied to the date-chart sense of calendar', () => assert.match(byId('6018').question, /chart of days/));
