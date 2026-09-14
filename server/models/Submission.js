const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentAssignment', required: true },
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    answers: [
      {
        question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
        answerText: { type: String, default: '' },
        // MCQ-only field: the option key ("A"/"B"/"C"/"D") the student submitted.
        selectedOption: { type: String, default: '' },
      },
    ],
    project: {
      originalName: { type: String },
      filePath: { type: String },
      sizeBytes: { type: Number },
      uploadedAt: { type: Date },
    },
    projectAnalysis: {
      status: { type: String, enum: ['not_analyzed', 'analyzing', 'analyzed', 'failed'], default: 'not_analyzed' },
      fileTree: [{ type: String }],
      hasPackageJson: { type: Boolean, default: false },
      hasReadme: { type: Boolean, default: false },
      hasTests: { type: Boolean, default: false },
      hasDatabaseFiles: { type: Boolean, default: false },
      hasScreenshots: { type: Boolean, default: false },
      dependencies: [{ type: String }],
      languages: [{ type: String }],
      sourceFileCount: { type: Number, default: 0 },
      totalFileCount: { type: Number, default: 0 },
      readmeExcerpt: { type: String, default: '' },
      keySourceExcerpts: [
        {
          filePath: String,
          excerpt: String,
        },
      ],
      warnings: [{ type: String }],
    },
    status: { type: String, enum: ['draft', 'submitted', 'late'], default: 'submitted' },
    submittedAt: { type: Date, default: Date.now },
    // Project workflow is separate from the MCQ answers above and tracked independently so a
    // student can submit their MCQ exam and their project at different times.
    projectStatus: { type: String, enum: ['not_submitted', 'submitted', 'evaluated'], default: 'not_submitted' },
    projectSubmittedAt: { type: Date },
    projectScore: { type: Number },
    projectMaxScore: { type: Number, default: 100 },
    projectFeedback: { type: String, default: '' },
    projectEvaluatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    projectEvaluatedAt: { type: Date },
  },
  { timestamps: true }
);

submissionSchema.index({ student: 1 });
submissionSchema.index({ assessment: 1 });
submissionSchema.index({ status: 1 });

module.exports = mongoose.model('Submission', submissionSchema);
