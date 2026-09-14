const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Result = require('../models/Result');
const Evaluation = require('../models/Evaluation');
const Assessment = require('../models/Assessment');
const CaseStudy = require('../models/CaseStudy');
const User = require('../models/User');
const reportGenerator = require('../services/reportGenerator');

const listResults = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role === 'student') filter.student = req.user._id;
  if (req.query.assessmentId) filter.assessment = req.query.assessmentId;

  const results = await Result.find(filter)
    .populate('student', 'name email studentId course semester section')
    .populate({
      path: 'assessment',
      select: 'title difficulty subjects durationMinutes',
      populate: { path: 'subjects', select: 'name' },
    })
    .sort({ publishedAt: -1 });
  res.json({ success: true, results });
});

const getStudentResult = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  if (req.user.role === 'student' && String(req.user._id) !== studentId) {
    throw new ApiError(403, 'You do not have access to this data.');
  }
  const results = await Result.find({ student: studentId })
    .populate({
      path: 'assessment',
      select: 'title difficulty subjects durationMinutes',
      populate: { path: 'subjects', select: 'name' },
    })
    .sort({ publishedAt: -1 });
  res.json({ success: true, results });
});

const getResultDetail = asyncHandler(async (req, res) => {
  const result = await Result.findById(req.params.id).populate('student', 'name email studentId course semester section').populate('assessment');
  if (!result) throw new ApiError(404, 'Result not found.');
  if (req.user.role === 'student' && String(result.student._id) !== String(req.user._id)) {
    throw new ApiError(403, 'You do not have access to this result.');
  }
  const evaluation = await Evaluation.findById(result.evaluation);
  const caseStudy = await CaseStudy.findOne({ assessment: result.assessment._id });
  res.json({ success: true, result, evaluation, caseStudy });
});

const downloadReport = asyncHandler(async (req, res) => {
  const result = await Result.findById(req.params.id).populate('student').populate('assessment');
  if (!result) throw new ApiError(404, 'Result not found.');
  if (req.user.role === 'student' && String(result.student._id) !== String(req.user._id)) {
    throw new ApiError(403, 'You do not have access to this result.');
  }
  const evaluation = await Evaluation.findById(result.evaluation);
  const caseStudy = await CaseStudy.findOne({ assessment: result.assessment._id });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="report-${result.student.name.replace(/\s+/g, '_')}.pdf"`);
  reportGenerator.streamEvaluationReport({ student: result.student, assessment: result.assessment, caseStudy, evaluation, result }, res);
});

module.exports = { listResults, getStudentResult, getResultDetail, downloadReport };
