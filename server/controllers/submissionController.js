const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');

function assertCanAccessSubmission(req, submission) {
  if (req.user.role === 'student' && String(submission.student._id || submission.student) !== String(req.user._id)) {
    throw new ApiError(403, 'You do not have access to this submission.');
  }
}

const listSubmissions = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.assessmentId) filter.assessment = req.query.assessmentId;
  if (req.user.role === 'student') filter.student = req.user._id;

  const submissions = await Submission.find(filter)
    .populate('student', 'name email studentId course semester section')
    .populate('assessment', 'title difficulty')
    .sort({ submittedAt: -1 });

  const evaluations = await Evaluation.find({ submission: { $in: submissions.map((s) => s._id) } }).select('submission status ai.overallScore review.finalScore');
  const evalMap = new Map(evaluations.map((e) => [String(e.submission), e]));

  const enriched = submissions.map((s) => {
    const evaluation = evalMap.get(String(s._id));
    return {
      ...s.toObject(),
      evaluationStatus: evaluation ? evaluation.status : 'not_evaluated',
      aiScore: evaluation?.ai?.overallScore,
      finalScore: evaluation?.review?.finalScore,
    };
  });

  res.json({ success: true, submissions: enriched });
});

const getSubmission = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id)
    .populate('student', 'name email studentId course semester section')
    .populate('assessment');
  if (!submission) throw new ApiError(404, 'Submission not found.');
  assertCanAccessSubmission(req, submission);
  const evaluation = await Evaluation.findOne({ submission: submission._id });
  res.json({ success: true, submission, evaluation });
});

// Streams the raw uploaded project ZIP. Admin/evaluator can access any submission; a student can
// only download their own.
const downloadProject = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id);
  if (!submission) throw new ApiError(404, 'Submission not found.');
  assertCanAccessSubmission(req, submission);
  if (!submission.project || !submission.project.filePath) {
    throw new ApiError(404, 'No project file has been submitted for this assessment.');
  }
  res.download(submission.project.filePath, submission.project.originalName || 'project.zip');
});

// Manual project scoring — deliberately deterministic/human-entered rather than routed through
// Gemini, since only MCQ grading is AI-free-by-design here; project review stays a faculty call.
const evaluateProject = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id);
  if (!submission) throw new ApiError(404, 'Submission not found.');
  if (submission.projectStatus === 'not_submitted') {
    throw new ApiError(400, 'This student has not submitted a project yet.');
  }

  const { score, feedback } = req.body;
  const numericScore = Number(score);
  if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > (submission.projectMaxScore || 100)) {
    throw new ApiError(400, `score must be a number between 0 and ${submission.projectMaxScore || 100}.`);
  }

  submission.projectScore = numericScore;
  submission.projectFeedback = feedback || '';
  submission.projectStatus = 'evaluated';
  submission.projectEvaluatedBy = req.user._id;
  submission.projectEvaluatedAt = new Date();
  await submission.save();

  res.json({ success: true, submission });
});

module.exports = { listSubmissions, getSubmission, downloadProject, evaluateProject };
