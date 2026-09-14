const fs = require('fs');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Syllabus = require('../models/Syllabus');
const Subject = require('../models/Subject');
const syllabusService = require('../services/syllabusService');
const aiService = require('../services/aiService');

const uploadSyllabus = asyncHandler(async (req, res) => {
  const { subjectId } = req.body;
  if (!req.file) throw new ApiError(400, 'A syllabus file (PDF, DOCX, or TXT) is required.');
  if (!subjectId) throw new ApiError(400, 'subjectId is required.');

  const subject = await Subject.findById(subjectId);
  if (!subject) {
    fs.unlink(req.file.path, () => {});
    throw new ApiError(404, 'Subject not found.');
  }

  const fileType = syllabusService.detectFileType(req.file.originalname);
  let extractedText = '';
  try {
    extractedText = await syllabusService.extractText(req.file.path, fileType);
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    throw new ApiError(400, `Could not extract text from file: ${err.message}`);
  }

  if (!extractedText || extractedText.length < 30) {
    fs.unlink(req.file.path, () => {});
    throw new ApiError(400, 'The uploaded file did not contain readable text. Please check the file.');
  }

  // Replace any existing syllabus for this subject.
  const previous = await Syllabus.findOne({ subject: subjectId });
  if (previous) {
    fs.unlink(previous.filePath, () => {});
    await previous.deleteOne();
  }

  const syllabus = await Syllabus.create({
    subject: subjectId,
    fileName: req.file.filename,
    originalName: req.file.originalname,
    filePath: req.file.path,
    fileType,
    extractedText,
    status: 'uploaded',
    uploadedBy: req.user._id,
  });

  res.status(201).json({ success: true, syllabus });
});

const getSyllabus = asyncHandler(async (req, res) => {
  const syllabus = await Syllabus.findById(req.params.id).populate('subject');
  if (!syllabus) throw new ApiError(404, 'Syllabus not found.');
  res.json({ success: true, syllabus });
});

const listSyllabi = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.subjectId) filter.subject = req.query.subjectId;
  const syllabi = await Syllabus.find(filter).populate('subject').sort({ createdAt: -1 });
  res.json({ success: true, syllabi });
});

const analyzeSyllabus = asyncHandler(async (req, res) => {
  const syllabus = await Syllabus.findById(req.params.id).populate('subject');
  if (!syllabus) throw new ApiError(404, 'Syllabus not found.');

  syllabus.status = 'analyzing';
  await syllabus.save();

  try {
    const { analysis } = await syllabusService.analyzeSyllabus({
      subjectName: syllabus.subject.name,
      extractedText: syllabus.extractedText,
    });
    syllabus.analysis = analysis;
    syllabus.status = 'analyzed';
    syllabus.analyzedAt = new Date();
    await syllabus.save();
    res.json({ success: true, syllabus });
  } catch (err) {
    syllabus.status = 'failed';
    await syllabus.save();
    if (err instanceof aiService.AiGenerationError) {
      throw new ApiError(503, err.message);
    }
    throw err;
  }
});

const deleteSyllabus = asyncHandler(async (req, res) => {
  const syllabus = await Syllabus.findById(req.params.id);
  if (!syllabus) throw new ApiError(404, 'Syllabus not found.');
  fs.unlink(syllabus.filePath, () => {});
  await syllabus.deleteOne();
  res.json({ success: true, message: 'Syllabus deleted.' });
});

module.exports = { uploadSyllabus, getSyllabus, listSyllabi, analyzeSyllabus, deleteSyllabus };
