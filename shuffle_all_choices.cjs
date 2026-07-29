const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'lib', 'questions');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

let totalShuffled = 0;

files.forEach(f => {
  const filePath = path.join(dir, f);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  data.forEach(q => {
    // We only shuffle if there are exactly 4 choices (standard multiple choice)
    if (q.choices && q.choices.length === 4) {
      // Fisher-Yates shuffle
      for (let i = q.choices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [q.choices[i], q.choices[j]] = [q.choices[j], q.choices[i]];
      }
      totalShuffled++;
    }
  });

  fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
});

console.log(`Successfully shuffled choices for ${totalShuffled} questions.`);
