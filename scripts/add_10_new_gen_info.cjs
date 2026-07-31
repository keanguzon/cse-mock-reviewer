const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/lib/questions/general_info_constitution.json');
let data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// 10 Brand new, unique questions carefully crafted to have balanced choices (no obvious "long" answers).
const newQuestions = [
  {
    "id": "7101",
    "category": "General Information – Philippine Constitution & RA 6713",
    "question": "Which article of the 1987 Philippine Constitution outlines the Bill of Rights?",
    "choices": ["Article II", "Article III", "Article IV", "Article V"],
    "correct_answer": "Article III",
    "explanation": "Article III of the 1987 Constitution contains the Bill of Rights, which guarantees the civil and political rights of the people."
  },
  {
    "id": "7102",
    "category": "General Information – Philippine Constitution & RA 6713",
    "question": "Under RA 6713, public officials are strictly prohibited from soliciting gifts in the course of their duties. Which specific section covers this?",
    "choices": ["Section 4", "Section 5", "Section 6", "Section 7"],
    "correct_answer": "Section 7",
    "explanation": "Section 7 of RA 6713 outlines the prohibited acts and transactions, including the solicitation or acceptance of gifts."
  },
  {
    "id": "7103",
    "category": "General Information – Philippine Constitution & RA 6713",
    "question": "According to the 1987 Constitution, what is the maximum number of consecutive terms a Senator can serve?",
    "choices": ["One consecutive term", "Two consecutive terms", "Three consecutive terms", "Four consecutive terms"],
    "correct_answer": "Two consecutive terms",
    "explanation": "Article VI, Section 4 states that no Senator shall serve for more than two consecutive terms."
  },
  {
    "id": "7104",
    "category": "General Information – Philippine Constitution & RA 6713",
    "question": "Who holds the position of Commander-in-Chief of all armed forces of the Philippines?",
    "choices": ["The Chief of Staff", "The Secretary of Defense", "The President", "The Vice President"],
    "correct_answer": "The President",
    "explanation": "Article VII, Section 18 states that the President shall be the Commander-in-Chief of all armed forces of the Philippines."
  },
  {
    "id": "7105",
    "category": "General Information – Philippine Constitution & RA 6713",
    "question": "Which of the following documents must all public officials file under oath to declare their financial assets?",
    "choices": ["Statement of Income and Expenses", "Personal Data Sheet", "Statement of Assets and Liabilities", "Bureau of Internal Revenue Form"],
    "correct_answer": "Statement of Assets and Liabilities",
    "explanation": "Section 8 of RA 6713 requires all public officials and employees to file their SALN, including a disclosure of business interests and financial connections."
  },
  {
    "id": "7106",
    "category": "General Information – Philippine Constitution & RA 6713",
    "question": "In the Philippines, suffrage may be exercised by all qualified citizens who have reached what minimum age?",
    "choices": ["Fifteen years old", "Eighteen years old", "Twenty-one years old", "Twenty-five years old"],
    "correct_answer": "Eighteen years old",
    "explanation": "Article V, Section 1 of the Constitution provides that suffrage may be exercised by citizens who are at least eighteen years of age."
  },
  {
    "id": "7107",
    "category": "General Information – Philippine Constitution & RA 6713",
    "question": "Which RA 6713 norm requires providing service to everyone regardless of their party affiliation?",
    "choices": ["Justness and Sincerity", "Professionalism", "Political Neutrality", "Commitment to Democracy"],
    "correct_answer": "Political Neutrality",
    "explanation": "Under Section 4(b), 'Political Neutrality' means providing service to everyone without unfair discrimination and regardless of party affiliation."
  },
  {
    "id": "7108",
    "category": "General Information – Philippine Constitution & RA 6713",
    "question": "The legislative power of the Philippine government is officially vested in which specific body?",
    "choices": ["The Supreme Court", "The Office of the President", "The Congress of the Philippines", "The Constitutional Commission"],
    "correct_answer": "The Congress of the Philippines",
    "explanation": "Article VI, Section 1 states that legislative power shall be vested in the Congress of the Philippines."
  },
  {
    "id": "7109",
    "category": "General Information – Philippine Constitution & RA 6713",
    "question": "Under RA 6713, maintaining a standard of living proportionate to one's visible means of income is called:",
    "choices": ["Simple Living", "Financial Integrity", "Modest Standard", "Public Transparency"],
    "correct_answer": "Simple Living",
    "explanation": "Section 4(h) defines 'Simple Living' as maintaining a standard of living within the public official's or employee's visible means of income and position."
  },
  {
    "id": "7110",
    "category": "General Information – Philippine Constitution & RA 6713",
    "question": "According to the 1987 Constitution, how is the Vice President of the Philippines elected?",
    "choices": ["Appointed by the President", "Elected by the Senate", "Elected by direct vote", "Elected by the Congress"],
    "correct_answer": "Elected by direct vote",
    "explanation": "Article VII, Section 4 states that the President and Vice-President shall be elected by direct vote of the people."
  }
];

// Append and save
const updatedData = [...data, ...newQuestions];
fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 4));

console.log(`Successfully added 10 new questions. File now has ${updatedData.length} questions.`);
