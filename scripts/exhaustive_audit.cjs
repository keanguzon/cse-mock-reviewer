const fs = require('fs');
const path = require('path');

const questionsDir = path.join(__dirname, '../src/lib/questions');
const files = fs.readdirSync(questionsDir).filter(f => f.endsWith('.json'));

let totalIssues = 0;

files.forEach(file => {
    const filePath = path.join(questionsDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    data.forEach(q => {
        // Regex for blanks: at least 2 underscores OR at least 3 dots
        const blankRegex = /(_{2,}|\.{3,})/;
        
        if (blankRegex.test(q.question)) {
            // Find word after the blank (ignoring optional punctuation and spaces in between)
            const matchAfter = q.question.match(/(?:_{2,}|\.{3,})[^\w]*([a-zA-Z]+)/);
            if (matchAfter) {
                const wordAfterBlank = matchAfter[1].toLowerCase();
                const hasIssue = q.choices.some(c => {
                    const cleanChoice = c.toLowerCase().trim().replace(/[.,!?]/g, '');
                    return cleanChoice.endsWith(" " + wordAfterBlank) || cleanChoice === wordAfterBlank;
                });
                if (hasIssue) {
                    console.log(`\n[AFTER] ID: ${q.id} in ${file}`);
                    console.log(`Q: ${q.question}`);
                    console.log(`Choices: ${q.choices.join(' | ')}`);
                    console.log(`Flagged Word: '${wordAfterBlank}'`);
                    totalIssues++;
                }
            }

            // Find word before the blank
            const matchBefore = q.question.match(/([a-zA-Z]+)[^\w]*(?:_{2,}|\.{3,})/);
            if (matchBefore) {
                const wordBeforeBlank = matchBefore[1].toLowerCase();
                const hasIssue = q.choices.some(c => {
                    const cleanChoice = c.toLowerCase().trim().replace(/[.,!?]/g, '');
                    return cleanChoice.startsWith(wordBeforeBlank + " ") || cleanChoice === wordBeforeBlank;
                });
                if (hasIssue) {
                    console.log(`\n[BEFORE] ID: ${q.id} in ${file}`);
                    console.log(`Q: ${q.question}`);
                    console.log(`Choices: ${q.choices.join(' | ')}`);
                    console.log(`Flagged Word: '${wordBeforeBlank}'`);
                    totalIssues++;
                }
            }
        }
    });
});

console.log(`\nTotal exhaustive issues found: ${totalIssues}`);
