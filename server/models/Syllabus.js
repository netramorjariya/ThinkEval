const mongoose = require('mongoose');

const syllabusSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileType: { type: String, enum: ['pdf', 'docx', 'txt'], required: true },
    extractedText: { type: String, default: '' },
    analysis: {
      topics: [{ type: String }],
      subtopics: [
        {
          topic: { type: String },
          items: [{ type: String }],
        },
      ],
      learningObjectives: [{ type: String }],
      difficultyMapping: { type: mongoose.Schema.Types.Mixed, default: {} },
      practicalSkills: [{ type: String }],
      topicRelationships: [
        {
          from: String,
          to: String,
          relationship: String,
        },
      ],
    },
    status: { type: String, enum: ['uploaded', 'analyzing', 'analyzed', 'failed'], default: 'uploaded' },
    analyzedAt: { type: Date },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Syllabus', syllabusSchema);
