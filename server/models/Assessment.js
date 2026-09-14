const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true }],
    syllabi: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Syllabus', required: true }],
    difficulty: {
      type: String,
      enum: ['EASY', 'MEDIUM', 'HARD', 'VERY_HARD', 'EXPERT'],
      default: 'HARD',
    },
    durationMinutes: { type: Number, default: 90 },
    totalQuestions: { type: Number, default: 20, min: 1, max: 100 },
    marksPerQuestion: { type: Number, default: 5, min: 0.01 },
    totalMarks: { type: Number, default: 100 },
    // How many of totalQuestions Gemini should draw from each subject's syllabus. Created
    // alongside `subjects`/`syllabi` — index-aligned by subject id, not by array position.
    questionDistribution: [
      {
        subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
        count: { type: Number, required: true, min: 0 },
        _id: false,
      },
    ],
    // MCQ assessments are graded automatically from selected options — a project upload is only
    // required once an admin opts an exam into it from the Projects page (see projectRequirements).
    requiresProject: { type: Boolean, default: false },
    // Free-text project brief shown to students on the separate Project Submission workflow.
    projectRequirements: { type: String, default: '' },
    status: {
      type: String,
      enum: ['draft', 'generating', 'generated', 'failed', 'published', 'closed'],
      default: 'draft',
    },
    generationError: { type: String, default: '' },
    caseStudy: { type: mongoose.Schema.Types.ObjectId, ref: 'CaseStudy' },
    rubric: { type: mongoose.Schema.Types.ObjectId, ref: 'Rubric' },
    assignedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

assessmentSchema.index({ createdBy: 1 });
assessmentSchema.index({ status: 1 });

module.exports = mongoose.model('Assessment', assessmentSchema);
