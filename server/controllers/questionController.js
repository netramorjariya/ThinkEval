const asyncHandler = require('../utils/asyncHandler');
const Question = require('../models/Question');

const listQuestions = asyncHandler(async (req, res) => {
  // Route is restricted to admin/evaluator, so correct answers/explanations are safe to include for review.
  const questions = await Question.find({ assessment: req.params.assessmentId })
    .select('+correctAnswer +explanation')
    .sort({ order: 1 });
  res.json({ success: true, questions });
});

module.exports = { listQuestions };
