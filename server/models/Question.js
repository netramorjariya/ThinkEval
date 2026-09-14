const mongoose = require('mongoose');

const evaluationParameterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    weight: { type: Number, required: true }, // percentage, 0-100; all parameters for a question sum to 100
    maxMarks: { type: Number, required: true }, // derived: question.maxMarks * weight / 100
    evaluationInstructions: { type: String, default: '' },
  },
  { _id: false }
);

const mcqOptionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // e.g. "A", "B", "C", "D"
    text: { type: String, required: true },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
    // Which of the assessment's subjects this question was generated from. Optional/absent on
    // questions generated before subject-wise distribution existed.
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    order: { type: Number, required: true },
    title: { type: String, required: true },
    questionText: { type: String, required: true },
    type: {
      type: String,
      enum: ['long_text', 'short_text', 'structured', 'sql', 'code', 'project', 'mcq'],
      default: 'long_text',
    },
    difficulty: {
      type: String,
      enum: ['EASY', 'MEDIUM', 'HARD', 'VERY_HARD', 'EXPERT'],
      default: 'HARD',
    },
    topics: [{ type: String }],
    constraints: [{ type: String }],
    expectedSkills: [{ type: String }],
    evaluationCriteria: [{ type: String }],
    // Automatically-generated, question-specific grading rubric. Weights sum to 100.
    evaluationParameters: [evaluationParameterSchema],
    dataTemplate: { type: mongoose.Schema.Types.Mixed, default: {} },
    maxMarks: { type: Number, default: 10 },
    // MCQ-only fields. correctAnswer/explanation are never sent to students.
    options: [mcqOptionSchema],
    correctAnswer: { type: String, select: false },
    explanation: { type: String, select: false },
    negativeMarkingPerWrong: { type: Number, default: 0 }, // fraction of maxMarks deducted for a wrong MCQ answer
    qualityScore: { type: Number, default: 0 },
    qualityChecks: { type: mongoose.Schema.Types.Mixed, default: {} },
    analytics: {
      attempts: { type: Number, default: 0 },
      totalScore: { type: Number, default: 0 },
      averageScorePct: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Question', questionSchema);
