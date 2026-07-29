const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'lib', 'questions', 'analytical_logic.json');
let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

let targetCount = 18;
let swappedCount = 0;

data.forEach(q => {
  if (q.correct_answer === "Only conclusion I follows" && swappedCount < targetCount) {
    // Match the exact format:
    // - I. [Text]
    // - II. [Text]
    const concRegex = /- I\.\s*(.*?)\n\s*- II\.\s*(.*?)$/s;
    const match = q.question.match(concRegex);
    
    if (match) {
      const conc1 = match[1].trim();
      const conc2 = match[2].trim();
      
      const newQuestion = q.question.replace(concRegex, `- I. ${conc2}\n- II. ${conc1}`);
      q.question = newQuestion;
      
      q.correct_answer = "Only conclusion II follows";
      q.choices = q.choices.map(c => c === "Only conclusion I follows" ? "Only conclusion II follows" : c);
      
      // We already shuffled choices previously, but just to make sure we don't end up with duplicate choices:
      // if replacing caused a duplicate, let's just forcefully reset the choices to standard 4
      const uniqueChoices = new Set(q.choices);
      if (uniqueChoices.size < 4) {
         q.choices = [
           "Only conclusion I follows",
           "Only conclusion II follows",
           "Both conclusions I and II follow",
           "Neither conclusion I nor II follows"
         ];
      }
      
      if (q.explanation) {
        q.explanation = q.explanation
          .replace(/conclusion I\b/gi, 'TEMP_CONC')
          .replace(/conclusion II\b/gi, 'conclusion I')
          .replace(/TEMP_CONC/g, 'conclusion II')
          .replace(/\bI\b/g, 'TEMP_I')
          .replace(/\bII\b/g, 'I')
          .replace(/TEMP_I/g, 'II');
      }
      
      swappedCount++;
    }
  }
});

// Re-shuffle to randomize position of correct answer since we might have rebuilt choices
data.forEach(q => {
  if (q.choices && q.choices.length === 4) {
    for (let i = q.choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q.choices[i], q.choices[j]] = [q.choices[j], q.choices[i]];
    }
  }
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
console.log(`Successfully swapped Conclusion I and II for ${swappedCount} questions.`);
