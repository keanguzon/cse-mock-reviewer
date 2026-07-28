// Validation script for question bank integrity
const fs = require('fs');
const path = require('path');

const questionsDir = path.join(process.cwd(), 'src', 'lib', 'questions');
const jsonFiles = fs.readdirSync(questionsDir).filter(f => f.endsWith('.json'));

let totalQuestions = 0;
let errors = [];
let allIds = new Set();
let duplicateIds = [];

console.log('=== CSE Question Bank Validation ===\n');

for (const file of jsonFiles) {
    const filePath = path.join(questionsDir, file);
    let data;
    
    // 1. JSON syntax check
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        data = JSON.parse(raw);
    } catch (e) {
        errors.push(`❌ JSON SYNTAX ERROR in ${file}: ${e.message}`);
        continue;
    }
    
    // 2. Count check
    const count = data.length;
    totalQuestions += count;
    const countStatus = count === 50 ? '✅' : '⚠️';
    console.log(`${countStatus} ${file}: ${count} questions`);
    
    if (count !== 50) {
        errors.push(`⚠️ ${file} has ${count} questions (expected 50)`);
    }
    
    // 3. Schema validation per question
    for (let i = 0; i < data.length; i++) {
        const q = data[i];
        const prefix = `${file}[${i}]`;
        
        // Required fields
        if (!q.id) errors.push(`❌ ${prefix}: missing 'id'`);
        if (!q.category) errors.push(`❌ ${prefix}: missing 'category'`);
        if (!q.question) errors.push(`❌ ${prefix}: missing 'question'`);
        if (!q.correct_answer) errors.push(`❌ ${prefix}: missing 'correct_answer'`);
        if (!q.explanation) errors.push(`⚠️ ${prefix}: missing 'explanation'`);
        
        // Choices validation
        if (!Array.isArray(q.choices)) {
            errors.push(`❌ ${prefix}: 'choices' is not an array`);
        } else if (q.choices.length !== 4) {
            errors.push(`⚠️ ${prefix}: has ${q.choices.length} choices (expected 4)`);
        }
        
        // Correct answer must be in choices
        if (Array.isArray(q.choices) && q.correct_answer && !q.choices.includes(q.correct_answer)) {
            errors.push(`❌ ${prefix}: correct_answer "${q.correct_answer}" NOT found in choices: ${JSON.stringify(q.choices)}`);
        }
        
        // Duplicate ID check
        if (q.id) {
            if (allIds.has(q.id)) {
                duplicateIds.push(q.id);
            }
            allIds.add(q.id);
        }
    }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Total files: ${jsonFiles.length}`);
console.log(`Total questions: ${totalQuestions}`);
console.log(`Unique IDs: ${allIds.size}`);
console.log(`Duplicate IDs: ${duplicateIds.length}`);

if (duplicateIds.length > 0) {
    console.log(`\nDuplicate IDs found:`);
    duplicateIds.forEach(id => console.log(`  - ${id}`));
}

if (errors.length > 0) {
    console.log(`\n=== ERRORS (${errors.length}) ===`);
    errors.forEach(e => console.log(e));
} else {
    console.log(`\n✅ ALL CHECKS PASSED - No errors found`);
}

process.exit(errors.length > 0 ? 1 : 0);
