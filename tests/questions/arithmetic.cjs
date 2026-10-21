function evaluateArithmetic(raw) {
  const source = raw.replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/²/g, '^2').replace(/³/g, '^3').replace(/\[/g, '(').replace(/\]/g, ')');
  const tokens = source.match(/\d+(?:\.\d+)?|[()+*/^\-]/g) || [];
  if (tokens.join('') !== source.replace(/\s/g, '')) throw new Error(`Unsupported arithmetic: ${raw}`);
  let index = 0;
  function primary() {
    if (tokens[index] === '(') {
      index++;
      const value = sum();
      if (tokens[index++] !== ')') throw new Error('Missing closing parenthesis');
      return value;
    }
    if (!/^\d/.test(tokens[index] || '')) throw new Error('Expected number');
    return Number(tokens[index++]);
  }
  function power() {
    const left = primary();
    if (tokens[index] === '^') { index++; return left ** unary(); }
    return left;
  }
  function unary() {
    if (tokens[index] === '-') { index++; return -unary(); }
    if (tokens[index] === '+') { index++; return unary(); }
    return power();
  }
  function product() {
    let value = unary();
    while (tokens[index] === '*' || tokens[index] === '/') {
      const operator = tokens[index++], next = unary();
      if (operator === '/' && next === 0) throw new Error('Division by zero');
      value = operator === '*' ? value * next : value / next;
    }
    return value;
  }
  function sum() {
    let value = product();
    while (tokens[index] === '+' || tokens[index] === '-') {
      const operator = tokens[index++], next = product();
      value = operator === '+' ? value + next : value - next;
    }
    return value;
  }
  const result = sum();
  if (index !== tokens.length || !Number.isFinite(result)) throw new Error('Invalid arithmetic');
  return result;
}

module.exports = { evaluateArithmetic };
