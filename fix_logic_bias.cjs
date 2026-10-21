const fs = require('node:fs');
const path = require('node:path');
function swapConclusionLabels(explanation) {
  return explanation.replace(/\b(?:II|I)\b/g, label => label === 'I' ? 'II' : 'I');
}
function main(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let swappedCount = 0;
  for (const question of data) {
    if (question.correct_answer !== 'Only conclusion I follows' || swappedCount >= 18) continue;
    const pattern = /- I\.\s*(.*?)\n\s*- II\.\s*(.*?)$/s;
    const match = question.question.match(pattern);
    if (!match) continue;
    question.question = question.question.replace(pattern, `- I. ${match[2].trim()}\n- II. ${match[1].trim()}`);
    question.correct_answer = 'Only conclusion II follows';
    question.explanation = swapConclusionLabels(question.explanation);
    swappedCount++;
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
  console.log(`Successfully swapped Conclusion I and II for ${swappedCount} questions.`);
}
module.exports = { swapConclusionLabels };
if (require.main === module) main(process.argv[2] || path.join(__dirname, 'src/lib/questions/analytical_logic.json'));
