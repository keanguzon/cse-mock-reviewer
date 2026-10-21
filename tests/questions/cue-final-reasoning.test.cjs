const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const bank = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/lib/questions/analytical_logic.json'), 'utf8'));
for (const id of ['4007', '4011', '4020', '4037']) {
  test(`${id} evaluates each conclusion independently and has countermodels for both`, () => {
    const item = bank.find(q => q.id === id);
    assert.match(item.question, /each conclusion independently/);
    assert.ok(!item.choices.includes('Either conclusion I or II follows'));
    const possible = new Set();
    // Enumerate every finite membership type for three sets, including empty sets.
    for (let world = 0; world < 256; world++) {
      const types = Array.from({ length: 8 }, (_, type) => type).filter(type => world & (1 << type));
      const some = (a, b) => types.some(type => (type & a) && (type & b));
      const all = (a, b) => types.every(type => !(type & a) || (type & b));
      const premises = id === '4011' ? all(1, 2) && some(2, 4) : some(1, 2) && some(2, 4);
      if (premises) possible.add(some(1, 4));
    }
    assert.deepEqual([...possible].sort(), [false, true]);
    assert.equal(item.correct_answer, 'Neither conclusion I nor II follows');
  });
}
