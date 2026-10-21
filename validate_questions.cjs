const fs=require('node:fs');
const path=require('node:path');
const expectedCounts = Object.freeze({
  'analytical_analogy.json': 100,
  'analytical_assumptions.json': 100,
  'analytical_data_interpretation.json': 100,
  'analytical_logic.json': 100,
  'clerical_filing.json': 50,
  'clerical_spelling.json': 50,
  'general_info_constitution.json': 100,
  'general_info_current_events.json': 100,
  'numerical_age_problems.json': 75,
  'numerical_fractions.json': 75,
  'numerical_number_series.json': 75,
  'numerical_pemdas.json': 75,
  'numerical_word_problems.json': 75,
  'numerical_work_problems.json': 75,
  'verbal_balarila_filipino.json': 50,
  'verbal_correct_usage.json': 100,
  'verbal_grammar.json': 100,
  'verbal_idyoma_filipino.json': 50,
  'verbal_pagaunawa_filipino.json': 50,
  'verbal_paragraph_org.json': 100,
  'verbal_reading_comprehension.json': 100,
  'verbal_vocabulary.json': 100,
  'verbal_vocabulary_filipino.json': 50
});
function validateQuestionBank(files,counts) {
 const errors=[],ids=new Set(),names=new Set(); let total=0;
 const nonemptyString=value=>typeof value==='string'&&value.trim().length>0;
 for(const {name,questions} of files){
  if(names.has(name)) errors.push(`${name}: duplicate file`);
  names.add(name);
  if(!Object.hasOwn(counts,name)) errors.push(`${name}: unexpected file`);
  if(!Array.isArray(questions)){errors.push(`${name}: questions must be an array`);continue;}
  total+=questions.length;
  if(questions.length!==counts[name]) errors.push(`${name}: ${questions.length} questions (expected ${counts[name]})`);
  questions.forEach((question,index)=>{
   const prefix=`${name}[${index}]`;
   if(!question||typeof question!=='object'||Array.isArray(question)){errors.push(`${prefix}: question must be an object`);return;}
   for(const field of ['id','category','question','correct_answer','explanation']) if(!nonemptyString(question[field])) errors.push(`${prefix}: '${field}' must be a nonempty string`);
   if(nonemptyString(question.id)){if(ids.has(question.id))errors.push(`${prefix}: duplicate ID ${question.id}`);ids.add(question.id);}
   if(!Array.isArray(question.choices)) errors.push(`${prefix}: choices must be an array`);
   else {
    if(question.choices.length!==4) errors.push(`${prefix}: expected exactly four choices`);
    if(!question.choices.every(nonemptyString)) errors.push(`${prefix}: choices must be nonempty strings`);
    if(new Set(question.choices).size!==question.choices.length) errors.push(`${prefix}: duplicate choice strings`);
    if(question.choices.filter(choice=>choice===question.correct_answer).length!==1) errors.push(`${prefix}: correct_answer must match exactly one choice`);
   }
  });
 }
 for(const name of Object.keys(counts))if(!names.has(name))errors.push(`${name}: missing expected file`);
 return {errors,total};
}
function main(args){
 if(args.length&&(args.length!==2||args[0]!=='--dir'))throw Error('Usage: node validate_questions.cjs [--dir directory]');
 const dir=args.length?path.resolve(args[1]):path.join(__dirname,'src/lib/questions');
 const syntaxErrors=[];
 const files=fs.readdirSync(dir).filter(name=>name.endsWith('.json')).sort().map(name=>{try{return {name,questions:JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'))};}catch(error){syntaxErrors.push(`${name}: JSON syntax error: ${error.message}`);return {name,questions:null};}});
 const {errors,total}=validateQuestionBank(files,expectedCounts);errors.unshift(...syntaxErrors);
 console.log('=== CSE Question Bank Validation ===');
 for(const {name,questions}of files)console.log(`${name}: ${Array.isArray(questions)?questions.length:'invalid'} questions`);
 const ids=files.flatMap(file=>Array.isArray(file.questions)?file.questions.map(question=>question?.id):[]);
 console.log(`\nTotal files: ${files.length}\nTotal questions: ${total}\nUnique IDs: ${new Set(ids).size}`);
 if(errors.length)for(const error of errors)console.error(error);else console.log('All structural checks passed. Editorial accuracy is tracked separately.');
 return errors.length?1:0;
}
module.exports={validateQuestionBank,expectedCounts};
if(require.main === module){try{process.exitCode=main(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}}
