const mongoose = require('mongoose');

const caseStudySchema = new mongoose.Schema(
  {
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
    title: { type: String, required: true },
    background: { type: String, required: true },
    scenario: { type: String, required: true },
    subjectsInvolved: [{ type: String }],
    crossSubjectTopics: [{ type: String }],
    constraints: [{ type: String }],
    stakeholders: [{ type: String }],
    rawModelOutput: { type: mongoose.Schema.Types.Mixed },
    generatedBy: { type: String, enum: ['gemini', 'groq'], default: 'gemini' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CaseStudy', caseStudySchema);
