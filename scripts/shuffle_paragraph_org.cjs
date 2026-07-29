const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'lib', 'questions', 'verbal_paragraph_org.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// We want to seed the random so it's somewhat deterministic or just use Math.random
let updatedCount = 0;

data.forEach(q => {
  // Only process questions that have a sequence answer (e.g., "2-4-1-3")
  if (!q.correct_answer.match(/^\d-\d-\d-\d$/)) return;

  // Extract the four sentences
  const sentenceRegex = /\(1\) (.*?)\n\(2\) (.*?)\n\(3\) (.*?)\n\(4\) (.*?)$/s;
  const match = q.question.match(sentenceRegex);
  
  if (!match) return;

  const sentences = [
    match[1].trim(), // old 1
    match[2].trim(), // old 2
    match[3].trim(), // old 3
    match[4].trim()  // old 4
  ];

  // We want to assign a new number 1..4 to each old sentence
  // Let's create a random permutation of [0, 1, 2, 3]
  const newIndices = [0, 1, 2, 3];
  for (let i = newIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newIndices[i], newIndices[j]] = [newIndices[j], newIndices[i]];
  }
  // newIndices maps: new position -> old sentence index
  // e.g., newIndices[0] = 2 means new (1) is old (3)
  
  // Create mapping: old sentence number (1-4) -> new sentence number (1-4)
  const oldToNew = {};
  for (let newPos = 0; newPos < 4; newPos++) {
    const oldIndex = newIndices[newPos];
    oldToNew[oldIndex + 1] = newPos + 1;
  }

  // Rebuild the question text
  const prefix = q.question.substring(0, match.index).trim();
  const newQuestion = `${prefix}\n\n(1) ${sentences[newIndices[0]]}\n(2) ${sentences[newIndices[1]]}\n(3) ${sentences[newIndices[2]]}\n(4) ${sentences[newIndices[3]]}`;
  
  q.question = newQuestion;

  // Update choices
  q.choices = q.choices.map(choice => {
    if (choice.match(/^\d-\d-\d-\d$/)) {
      const parts = choice.split('-');
      const newParts = parts.map(p => oldToNew[parseInt(p)]);
      return newParts.join('-');
    }
    return choice;
  });

  // Update correct answer
  const correctParts = q.correct_answer.split('-');
  q.correct_answer = correctParts.map(p => oldToNew[parseInt(p)]).join('-');

  // Also replace mentions of "Sentence X" in explanation
  if (q.explanation) {
    q.explanation = q.explanation.replace(/Sentence (\d)/g, (m, oldNum) => {
      return `Sentence ${oldToNew[parseInt(oldNum)]}`;
    });
  }

  updatedCount++;
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
console.log(`Shuffled sentences for ${updatedCount} paragraph org questions.`);
