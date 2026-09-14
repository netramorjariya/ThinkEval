const { scoreToGrade } = require('../utils/grade');

const VALID_KEYS = ['A', 'B', 'C', 'D'];

/**
 * Deterministic MCQ grading — no AI call involved. Compares each submitted
 * selectedOption against the question's stored correctAnswer. Awards full
 * maxMarks for a correct answer, zero for a wrong or missing one (no negative marking).
 *
 * `questions` must include the select:false correctAnswer/explanation fields
 * (fetch with .select('+correctAnswer +explanation')).
 */
function gradeMcqSubmission({ questions, answers }) {
  const answerByQuestion = new Map(answers.map((a) => [String(a.question), a]));

  let finalScore = 0;
  let maxScore = 0;
  let correctCount = 0;

  const perQuestion = questions.map((q) => {
    const submitted = answerByQuestion.get(String(q._id));
    const selectedOption = VALID_KEYS.includes(String(submitted?.selectedOption).toUpperCase())
      ? String(submitted.selectedOption).toUpperCase()
      : '';
    const correctAnswer = String(q.correctAnswer || '').toUpperCase();
    const isCorrect = Boolean(selectedOption) && selectedOption === correctAnswer;
    const scoreAwarded = isCorrect ? q.maxMarks : 0;

    finalScore += scoreAwarded;
    maxScore += q.maxMarks;
    if (isCorrect) correctCount += 1;

    return {
      question: q._id,
      questionText: q.questionText,
      topics: q.topics,
      difficulty: q.difficulty,
      options: q.options,
      selectedOption: selectedOption || null,
      correctAnswer,
      isCorrect,
      explanation: q.explanation || '',
      scoreAwarded,
      maxMarks: q.maxMarks,
    };
  });

  const percentage = maxScore ? Math.round((finalScore / maxScore) * 10000) / 100 : 0;
  const grade = scoreToGrade(percentage);

  return { finalScore, maxScore, correctCount, totalQuestions: questions.length, percentage, grade, perQuestion };
}

module.exports = { gradeMcqSubmission };
