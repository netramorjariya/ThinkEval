const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema(
  {
    submission: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true, unique: true },
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ai: {
      overallScore: { type: Number },
      criteria: [
        {
          name: String,
          maxMarks: Number,
          scoreAwarded: Number,
          reasoning: String,
        },
      ],
      strengths: [{ type: String }],
      weaknesses: [{ type: String }],
      recommendations: [{ type: String }],
      scenarioCompliance: { type: String, default: '' },
      missingRequirements: [{ type: String }],
      technicalIssues: [{ type: String }],
      evidence: [
        {
          claim: String,
          source: String,
          verified: { type: Boolean, default: false },
        },
      ],
      uiEvaluation: {
        applicable: { type: Boolean, default: false },
        score: { type: Number },
        pros: [{ type: String }],
        cons: [{ type: String }],
      },
      perQuestion: [
        {
          question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
          scoreAwarded: Number,
          maxMarks: Number,
          reasoning: String,
          // MCQ deterministic-grading fields (never populated by AI evaluation).
          questionText: String,
          topics: [{ type: String }],
          difficulty: String,
          options: [{ key: String, text: String }],
          selectedOption: String,
          correctAnswer: String,
          isCorrect: Boolean,
          explanation: String,
        },
      ],
      confidenceScore: { type: Number },
      manualReviewRecommended: { type: Boolean, default: false },
      manualReviewReasons: [{ type: String }],
      rawModelOutput: { type: mongoose.Schema.Types.Mixed },
      evaluatedAt: { type: Date },
      // 'system' marks deterministic MCQ grading (no AI call involved).
      provider: { type: String, enum: ['gemini', 'groq', 'system'], default: 'gemini' },
    },
    review: {
      status: { type: String, enum: ['pending', 'approved', 'modified', 'rejected'], default: 'pending' },
      finalScore: { type: Number },
      modifiedCriteria: [
        {
          name: String,
          maxMarks: Number,
          scoreAwarded: Number,
        },
      ],
      comment: { type: String, default: '' },
      reason: { type: String, default: '' },
      evaluatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: { type: Date },
    },
    similarity: {
      flagged: { type: Boolean, default: false },
      matches: [
        {
          student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          codeSimilarityPct: Number,
          docSimilarityPct: Number,
        },
      ],
    },
    status: {
      type: String,
      enum: ['pending', 'evaluating', 'ai_evaluated', 'failed', 'reviewed', 'published'],
      default: 'pending',
    },
    error: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Evaluation', evaluationSchema);
