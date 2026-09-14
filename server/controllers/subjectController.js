const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Subject = require('../models/Subject');
const Syllabus = require('../models/Syllabus');

const listSubjects = asyncHandler(async (req, res) => {
  const subjects = await Subject.find().sort({ createdAt: -1 });
  res.json({ success: true, subjects });
});

const createSubject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) throw new ApiError(400, 'Subject name is required.');
  const subject = await Subject.create({ name, description, createdBy: req.user._id });
  res.status(201).json({ success: true, subject });
});

const deleteSubject = asyncHandler(async (req, res) => {
  const subject = await Subject.findById(req.params.id);
  if (!subject) throw new ApiError(404, 'Subject not found.');
  await Syllabus.deleteMany({ subject: subject._id });
  await subject.deleteOne();
  res.json({ success: true, message: 'Subject deleted.' });
});

module.exports = { listSubjects, createSubject, deleteSubject };
