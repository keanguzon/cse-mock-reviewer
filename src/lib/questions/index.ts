import verbalVocabulary from './verbal_vocabulary.json';
import verbalGrammar from './verbal_grammar.json';
import verbalCorrectUsage from './verbal_correct_usage.json';
import verbalParagraphOrg from './verbal_paragraph_org.json';
import verbalReadingComp from './verbal_reading_comprehension.json';
import analyticalAnalogy from './analytical_analogy.json';
import analyticalLogic from './analytical_logic.json';
import analyticalAssumptions from './analytical_assumptions.json';
import analyticalDataInterp from './analytical_data_interpretation.json';
import numericalWordProblems from './numerical_word_problems.json';
import numericalNumberSeries from './numerical_number_series.json';
import numericalAgeProblems from './numerical_age_problems.json';
import numericalWorkProblems from './numerical_work_problems.json';
import numericalFractions from './numerical_fractions.json';
import numericalPemdas from './numerical_pemdas.json';
import generalConstitution from './general_info_constitution.json';
import generalCurrentEvents from './general_info_current_events.json';
import clericalFiling from './clerical_filing.json';
import clericalSpelling from './clerical_spelling.json';

export type Question = {
    id: string;
    category: string;
    question: string;
    choices: string[];
    correct_answer: string;
    explanation?: string;
};

export type ExamLevel = 'professional' | 'subprofessional';

// Categories that belong to each exam level
const professionalOnlyCategories = [
    'Analytical Ability – Word Association / Analogy',
    'Analytical Ability – Logic / Syllogisms',
    'Analytical Ability – Assumptions & Conclusions',
    'Analytical Ability – Data Interpretation',
];

const subprofessionalOnlyCategories = [
    'Clerical Ability – Filing & Alphabetizing',
    'Clerical Ability – Spelling',
];

// All questions combined
export const allQuestions: Question[] = [
    ...verbalVocabulary,
    ...verbalGrammar,
    ...verbalCorrectUsage,
    ...verbalParagraphOrg,
    ...verbalReadingComp,
    ...analyticalAnalogy,
    ...analyticalLogic,
    ...analyticalAssumptions,
    ...analyticalDataInterp,
    ...numericalWordProblems,
    ...numericalNumberSeries,
    ...numericalAgeProblems,
    ...numericalWorkProblems,
    ...numericalFractions,
    ...numericalPemdas,
    ...generalConstitution,
    ...generalCurrentEvents,
    ...clericalFiling,
    ...clericalSpelling,
];

// Get questions filtered by exam level
export function getQuestionsByLevel(level: ExamLevel): Question[] {
    if (level === 'professional') {
        return allQuestions.filter(q => !subprofessionalOnlyCategories.includes(q.category));
    } else {
        return allQuestions.filter(q => !professionalOnlyCategories.includes(q.category));
    }
}

// Get categories available across all questions (19 categories)
export function getAllCategories(): string[] {
    return [...new Set(allQuestions.map(q => q.category))].sort((a, b) => a.localeCompare(b));
}

// Get categories available for a given exam level
export function getCategoriesForLevel(level: ExamLevel): string[] {
    const questions = getQuestionsByLevel(level);
    return [...new Set(questions.map(q => q.category))];
}

// Get question count per category for a given level
export function getCategoryCountsForLevel(level: ExamLevel): Record<string, number> {
    const questions = getQuestionsByLevel(level);
    const counts: Record<string, number> = { "": questions.length };
    allQuestions.forEach(q => {
        counts[q.category] = (counts[q.category] || 0) + 1;
    });
    return counts;
}
