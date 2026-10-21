const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.resolve(__dirname,'../../src/lib/questions');
const bank=fs.readdirSync(dir).filter(f=>/^(analytical|numerical|clerical)_/.test(f)).flatMap(f=>JSON.parse(fs.readFileSync(path.join(dir,f))));
const q=id=>bank.find(q=>q.id===String(id));
const gcd=(a,b)=>b?gcd(b,a%b):a;
test('3042 selects the unique equivalent rainfall ratio in lowest terms',()=>{
 const item=q(3042),dry=50+30+40+60,wet=180+320;
 assert.match(item.question,/lowest terms/);
 const eligible=item.choices.filter(c=>{let [a,b]=c.split(':').map(Number);return a*wet===b*dry&&gcd(a,b)===1});
 assert.deepEqual(eligible,[item.correct_answer]);
});
test('3065 includes the budget needed to compute its peso answer',()=>{
 const item=q(3065);const total=Number(item.question.match(/P(\d+) million/)[1]);
 const answer=total*(50-20-10)/100;
 assert.equal(Number(item.correct_answer.match(/P([\d.]+)/)[1]),answer);
});
test('3093 has exactly one correctly rounded whole percentage',()=>{
 const item=q(3093);assert.match(item.question,/nearest whole percent/);
 const percentage=Math.round(340/(120+340+200+80)*100)+'%';
 assert.deepEqual(item.choices.filter(c=>c===percentage),[item.correct_answer]);
});
test('3024 preserves thousands of passengers in the mean and choices',()=>{
 const item=q(3024);const average=[45000,48000,42000,55000].reduce((a,b)=>a+b)/4;
 assert.equal(item.correct_answer,average.toLocaleString('en-US')+' thousand passengers');
 assert.ok(item.choices.every(c=>c.endsWith(' thousand passengers')));
});
test('3086 explicitly requests an unweighted mean',()=>{
 const item=q(3086);assert.match(item.question,/unweighted mean/);
 assert.equal(parseFloat(item.correct_answer),[4.5,3,6,2.5].reduce((a,b)=>a+b)/4);
});
test('2086 uses an inclusive threshold that applies to twelve absences',()=>{
 const item=q(2086);const threshold=Number(item.question.match(/at least (\d+)/)[1]);
 const count=Number(item.question.match(/incurred (\d+)/)[1]);
 assert.ok(count>=threshold);assert.match(item.correct_answer,/written reprimand/);
});
test('revised analogy alternatives contain one matching relation',()=>{
 const relations={1016:{Cement:'binder',Wall:'part-whole',Kiln:'manufacturing-place',Trowel:'tool'},1024:{'Chisel : Sculptor':'tool-user','Hammer : Nail':'tool-target','Author : Pen':'user-tool','Needle : Thread':'tool-material'},1033:{'Atlas : Cartographer':'work-creator','Anthology : Literature':'collection-content','Encyclopedia : Editor':'work-editor','Dictionary : Publisher':'work-publisher'},1043:{'Paper : Book':'material-product','Stage : Theater':'part-whole','Fabric : Garment':'material-product','Marble : Sculptor':'material-artist'},1050:{'Scale : Balance':'instrument-mechanism','Clock : Time':'instrument-reading','Ruler : Carpenter':'instrument-user','Thermometer : Mercury':'instrument-material'}};
 const target={1016:'part-whole',1024:'tool-user',1033:'collection-content',1043:'material-artist',1050:'instrument-reading'};
 for(const [id,mapping] of Object.entries(relations))assert.deepEqual(q(id).choices.filter(c=>mapping[c]===target[id]),[q(id).correct_answer]);
});
test('1083 fixes the rights-granting versus rights-removing relation',()=>{
 const item=q(1083);assert.match(item.question,/granting voting rights/);
 const effects={Support:0,Register:0,Empower:1,Disenfranchise:-1};
 assert.deepEqual(item.choices.filter(c=>effects[c]===-1),[item.correct_answer]);
});
