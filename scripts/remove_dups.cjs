const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/questions/general_info_constitution.json');
let data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const originalCount = data.length;

// IDs identified as semantic duplicates of earlier questions
const duplicateIdsToRemove = [
  '7053', '7056', '7051', '7057', '7054', 
  '7069', '7086', '7066', '7092', '7078'
];

data = data.filter(q => !duplicateIdsToRemove.includes(q.id));

// Verify format constraint for remaining questions
data.forEach(q => {
  if (!q.id || !q.category || !q.question || !Array.isArray(q.choices) || !q.correct_answer || !q.explanation) {
    throw new Error(`Format validation failed for question ID: ${q.id}`);
  }
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
console.log(`Removed ${originalCount - data.length} duplicate questions. New count: ${data.length}`);
