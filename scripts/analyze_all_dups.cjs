const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '../src/lib/questions');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

let allQ = [];
for (let f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
  data.forEach(q => {
    allQ.push({ id: q.id, file: f, text: q.question });
  });
}

// Logic: lowercase, remove punctuation, split into words
function getWords(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(x => x.length > 2);
}

// Logic: calculate how many words overlap between two questions
function similarity(w1, w2) {
  let overlap = 0;
  let set2 = new Set(w2);
  for (let w of w1) { if (set2.has(w)) overlap++; }
  return overlap / Math.max(w1.length, w2.length);
}

let dups = [];
for (let i = 0; i < allQ.length; i++) {
  for (let j = i + 1; j < allQ.length; j++) {
    // Only compare within the same file for now to find internal dupes
    if (allQ[i].file === allQ[j].file) {
      let w1 = getWords(allQ[i].text);
      let w2 = getWords(allQ[j].text);
      if (w1.length > 0 && w2.length > 0) {
        let sim = Math.max(similarity(w1, w2), similarity(w2, w1));
        if (sim > 0.85 && allQ[i].text !== allQ[j].text) {
           dups.push({ q1: allQ[i], q2: allQ[j], sim: sim.toFixed(2) });
        }
      }
    }
  }
}

console.log(`High-confidence semantic duplicates found: ${dups.length}`);
dups.forEach(d => {
  console.log(`\n[${d.sim}] File: ${d.q1.file}`);
  console.log(`- ${d.q1.id}: ${d.q1.text}`);
  console.log(`- ${d.q2.id}: ${d.q2.text}`);
});
