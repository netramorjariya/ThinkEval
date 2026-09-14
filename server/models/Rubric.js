const mongoose = require('mongoose');

const rubricSchema = new mongoose.Schema(
  {
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
    criteria: [
      {
        name: { type: String, required: true },
        description: { type: String, default: '' },
        maxMarks: { type: Number, required: true },
      },
    ],
    totalMarks: { type: Number, required: true, default: 100 },
    generatedBy: { type: String, enum: ['gemini', 'groq', 'default'], default: 'gemini' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Rubric', rubricSchema);
