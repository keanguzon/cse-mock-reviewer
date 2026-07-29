const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'lib', 'questions', 'verbal_vocabulary.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

let changed = 0;
data.forEach(q => {
  // Match ALL CAPS words (4+ letters) that are target vocabulary words
  q.question = q.question.replace(/\b([A-Z]{4,})\b/g, (match) => {
    // Convert to Title Case with underline tag
    const titleCase = match.charAt(0) + match.slice(1).toLowerCase();
    changed++;
    return `<u>${titleCase}</u>`;
  });
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
console.log(`Updated ${changed} target words in ${data.length} questions.`);
