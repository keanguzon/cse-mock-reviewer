const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'lib', 'questions');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

let total = 0;
let indexCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 'not_found': 0 };

files.forEach(f => {
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  data.forEach(q => {
    total++;
    const idx = q.choices.indexOf(q.correct_answer);
    if (idx >= 0 && idx < 4) {
      indexCounts[idx]++;
    } else {
      indexCounts['not_found']++;
    }
  });
});

console.log('--- CORRECT ANSWER POSITION DISTRIBUTION ---');
console.log('Total Questions:', total);
console.log('A (Index 0):', indexCounts[0], '(', (indexCounts[0]/total*100).toFixed(1) + '% )');
console.log('B (Index 1):', indexCounts[1], '(', (indexCounts[1]/total*100).toFixed(1) + '% )');
console.log('C (Index 2):', indexCounts[2], '(', (indexCounts[2]/total*100).toFixed(1) + '% )');
console.log('D (Index 3):', indexCounts[3], '(', (indexCounts[3]/total*100).toFixed(1) + '% )');
if(indexCounts['not_found'] > 0) console.log('Not Found:', indexCounts['not_found']);
