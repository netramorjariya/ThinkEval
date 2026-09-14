const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
    evaluation: { type: mongoose.Schema.Types.ObjectId, ref: 'Evaluation', required: true },
    finalScore: { type: Number, required: true },
    maxScore: { type: Number, required: true, default: 100 },
    grade: { type: String, required: true },
    totalQuestions: { type: Number },
    correctCount: { type: Number },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

resultSchema.index({ student: 1, assessment: 1 }, { unique: true });

module.exports = mongoose.model('Result', resultSchema);
