const fs = require('fs');
const path = require('path');

const questionsDir = path.join(__dirname, '../src/lib/questions');
const files = fs.readdirSync(questionsDir).filter(f => f.endsWith('.json'));

let totalIssues = 0;

files.forEach(file => {
    const filePath = path.join(questionsDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    let fileModified = false;

    data.forEach(q => {
        if (q.question.includes('____') || q.question.includes('___')) {
            // Check for duplicate words after the blank
            // Example: _____ from -> choice "different from"
            
            // Extract the word immediately after the blank
            const matchAfter = q.question.match(/_{3,}\s+([a-zA-Z]+)/);
            if (matchAfter) {
                const wordAfterBlank = matchAfter[1].toLowerCase();
                // Check if any choice ENDS with this word
                const hasIssue = q.choices.some(choice => choice.toLowerCase().endsWith(wordAfterBlank) || choice.toLowerCase() === wordAfterBlank);
                
                if (hasIssue) {
                    console.log(`\n[ISSUE IN ${file}] ID: ${q.id}`);
                    console.log(`Q: ${q.question}`);
                    console.log(`Choices: ${q.choices.join(', ')}`);
                    console.log(`-> Duplicate word detected after blank: "${wordAfterBlank}"`);
                    totalIssues++;
                }
            }

            // Extract the word immediately before the blank
            const matchBefore = q.question.match(/([a-zA-Z]+)\s+_{3,}/);
            if (matchBefore) {
                const wordBeforeBlank = matchBefore[1].toLowerCase();
                // Check if any choice STARTS with this word
                const hasIssue = q.choices.some(choice => choice.toLowerCase().startsWith(wordBeforeBlank) || choice.toLowerCase() === wordBeforeBlank);
                
                if (hasIssue) {
                    console.log(`\n[ISSUE IN ${file}] ID: ${q.id}`);
                    console.log(`Q: ${q.question}`);
                    console.log(`Choices: ${q.choices.join(', ')}`);
                    console.log(`-> Duplicate word detected before blank: "${wordBeforeBlank}"`);
                    totalIssues++;
                }
            }
        }
    });
});

console.log(`\nTotal potential duplicate word issues found: ${totalIssues}`);
