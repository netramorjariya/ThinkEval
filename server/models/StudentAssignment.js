const mongoose = require('mongoose');

const studentAssignmentSchema = new mongoose.Schema(
  {
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seed: { type: String, required: true },
    resolvedQuestions: [
      {
        question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
        order: { type: Number, required: true },
        questionText: { type: String, required: true },
        studentData: { type: mongoose.Schema.Types.Mixed, default: {} },
        type: { type: String, default: 'long_text' },
        maxMarks: { type: Number },
        options: [{ key: String, text: String }],
      },
    ],
    status: {
      type: String,
      enum: ['assigned', 'in_progress', 'submitted', 'evaluated', 'published'],
      default: 'assigned',
    },
    startedAt: { type: Date },
    dueAt: { type: Date },
    autosave: {
      answers: [
        {
          question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
          answerText: { type: String, default: '' },
          // MCQ-only field: the option key ("A"/"B"/"C"/"D") the student currently has selected.
          selectedOption: { type: String, default: '' },
          markedForReview: { type: Boolean, default: false },
        },
      ],
      lastSavedAt: { type: Date },
      timeRemainingSeconds: { type: Number },
    },
    submission: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission' },
  },
  { timestamps: true }
);

studentAssignmentSchema.index({ assessment: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('StudentAssignment', studentAssignmentSchema);
