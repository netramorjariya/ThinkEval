const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');
const Assessment = require('../models/Assessment');
const CaseStudy = require('../models/CaseStudy');
const Rubric = require('../models/Rubric');
const StudentAssignment = require('../models/StudentAssignment');
const Result = require('../models/Result');
const aiService = require('../services/aiService');
const evaluationEngine = require('../services/evaluationEngine');
const { compareSubmissionPair, HIGH_SIMILARITY_FLAG_PCT } = require('../services/uniquenessEngine');
const { scoreToGrade } = require('../utils/grade');
const jobStore = require('../services/jobStore');

async function evaluateSubmissionCore(submissionId) {
  const submission = await Submission.findById(submissionId);
  if (!submission) throw new ApiError(404, 'Submission not found.');

  let evaluation = await Evaluation.findOne({ submission: submission._id });
  if (!evaluation) {
    evaluation = await Evaluation.create({
      submission: submission._id,
      assessment: submission.assessment,
      student: submission.student,
      status: 'evaluating',
    });
  } else {
    evaluation.status = 'evaluating';
    evaluation.error = '';
    await evaluation.save();
  }

  const assessment = await Assessment.findById(submission.assessment);
  const caseStudy = await CaseStudy.findById(assessment.caseStudy);
  const rubric = await Rubric.findById(assessment.rubric);
  const assignment = await StudentAssignment.findOne({ assessment: assessment._id, student: submission.student });

  if (!caseStudy || !rubric || !assignment) {
    evaluation.status = 'failed';
    evaluation.error = 'Missing case study, rubric, or assignment data for this submission.';
    await evaluation.save();
    throw new ApiError(400, evaluation.error);
  }

  try {
    const { ai } = await evaluationEngine.evaluateSubmission({
      assessment,
      caseStudy,
      rubric,
      resolvedQuestions: assignment.resolvedQuestions,
      answers: submission.answers,
      projectAnalysis: submission.projectAnalysis,
    });

    evaluation.ai = ai;
    evaluation.status = 'ai_evaluated';
    evaluation.review.status = 'pending';
    await evaluation.save();

    assignment.status = 'evaluated';
    await assignment.save();

    return evaluation;
  } catch (err) {
    evaluation.status = 'failed';
    evaluation.error = err.message || 'AI evaluation temporarily unavailable. Please retry.';
    await evaluation.save();
    throw err;
  }
}

const evaluateOne = asyncHandler(async (req, res) => {
  try {
    const evaluation = await evaluateSubmissionCore(req.params.submissionId);
    res.json({ success: true, evaluation });
  } catch (err) {
    if (err instanceof aiService.AiGenerationError) throw new ApiError(503, err.message);
    throw err;
  }
});

const evaluateAll = asyncHandler(async (req, res) => {
  const { assessmentId } = req.body;
  if (!assessmentId) throw new ApiError(400, 'assessmentId is required.');

  const submissions = await Submission.find({ assessment: assessmentId });
  const existingEvaluations = await Evaluation.find({ assessment: assessmentId });
  const evaluatedSubmissionIds = new Set(
    existingEvaluations.filter((e) => ['ai_evaluated', 'reviewed', 'published'].includes(e.status)).map((e) => String(e.submission))
  );
  const eligible = submissions.filter((s) => !evaluatedSubmissionIds.has(String(s._id)));

  if (eligible.length === 0) {
    return res.json({ success: true, message: 'No eligible submissions to evaluate.', jobId: null, total: 0 });
  }

  const jobId = jobStore.createJob(eligible.length);

  // Run sequentially in the background so we respect AI rate limits and don't block the request.
  (async () => {
    for (const submission of eligible) {
      try {
        await evaluateSubmissionCore(submission._id);
        jobStore.pushResult(jobId, { success: true, submissionId: String(submission._id) });
      } catch (err) {
        jobStore.pushResult(jobId, { success: false, submissionId: String(submission._id), error: err.message });
      }
    }
  })();

  res.status(202).json({ success: true, jobId, total: eligible.length });
});

const getJobStatus = asyncHandler(async (req, res) => {
  const job = jobStore.getJob(req.params.jobId);
  if (!job) throw new ApiError(404, 'Job not found.');
  res.json({ success: true, job });
});

const getEvaluation = asyncHandler(async (req, res) => {
  const evaluation = await Evaluation.findById(req.params.id)
    .populate('student', 'name email studentId course semester section')
    .populate('assessment');
  if (!evaluation) throw new ApiError(404, 'Evaluation not found.');
  res.json({ success: true, evaluation });
});

const listEvaluations = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.assessmentId) filter.assessment = req.query.assessmentId;
  if (req.query.status) filter.status = req.query.status;
  const evaluations = await Evaluation.find(filter)
    .populate('student', 'name email studentId course semester section')
    .populate('assessment', 'title difficulty')
    .sort({ createdAt: -1 });
  res.json({ success: true, evaluations });
});

const reviewEvaluation = asyncHandler(async (req, res) => {
  const evaluation = await Evaluation.findById(req.params.id);
  if (!evaluation) throw new ApiError(404, 'Evaluation not found.');
  if (evaluation.status !== 'ai_evaluated' && evaluation.status !== 'reviewed') {
    throw new ApiError(400, 'This submission has not yet been AI-evaluated.');
  }

  const { action, modifiedCriteria, comment, reason } = req.body;
  if (!['approve', 'modify', 'reject'].includes(action)) {
    throw new ApiError(400, 'action must be one of approve, modify, reject.');
  }

  if (action === 'approve') {
    evaluation.review = {
      status: 'approved',
      finalScore: evaluation.ai.overallScore,
      modifiedCriteria: [],
      comment: comment || '',
      reason: '',
      evaluatedBy: req.user._id,
      reviewedAt: new Date(),
    };
  } else if (action === 'modify') {
    if (!Array.isArray(modifiedCriteria) || modifiedCriteria.length === 0) {
      throw new ApiError(400, 'modifiedCriteria is required when modifying marks.');
    }
    if (!reason) {
      throw new ApiError(400, 'A reason is required when changing AI-generated marks.');
    }
    const finalScore = modifiedCriteria.reduce((sum, c) => sum + (Number(c.scoreAwarded) || 0), 0);
    evaluation.review = {
      status: 'modified',
      finalScore,
      modifiedCriteria,
      comment: comment || '',
      reason,
      evaluatedBy: req.user._id,
      reviewedAt: new Date(),
    };
  } else {
    if (!reason) throw new ApiError(400, 'A reason is required when rejecting an AI evaluation.');
    evaluation.review = {
      status: 'rejected',
      finalScore: undefined,
      modifiedCriteria: [],
      comment: comment || '',
      reason,
      evaluatedBy: req.user._id,
      reviewedAt: new Date(),
    };
  }

  evaluation.status = 'reviewed';
  await evaluation.save();
  res.json({ success: true, evaluation });
});

const publishResult = asyncHandler(async (req, res) => {
  const evaluation = await Evaluation.findById(req.params.id);
  if (!evaluation) throw new ApiError(404, 'Evaluation not found.');
  if (evaluation.status !== 'reviewed') {
    throw new ApiError(400, 'Evaluation must be reviewed by an evaluator before publishing.');
  }
  if (evaluation.review.status === 'rejected') {
    throw new ApiError(400, 'Cannot publish a rejected evaluation. Trigger re-evaluation first.');
  }

  const finalScore = evaluation.review.finalScore ?? evaluation.ai.overallScore;
  const maxScore = 100;
  const grade = scoreToGrade((finalScore / maxScore) * 100);

  const result = await Result.findOneAndUpdate(
    { student: evaluation.student, assessment: evaluation.assessment },
    { student: evaluation.student, assessment: evaluation.assessment, evaluation: evaluation._id, finalScore, maxScore, grade, publishedAt: new Date() },
    { upsert: true, new: true }
  );

  evaluation.status = 'published';
  await evaluation.save();

  await StudentAssignment.findOneAndUpdate(
    { assessment: evaluation.assessment, student: evaluation.student },
    { status: 'published' }
  );

  res.json({ success: true, result });
});

const checkSimilarity = asyncHandler(async (req, res) => {
  const { assessmentId } = req.params;
  const submissions = await Submission.find({ assessment: assessmentId }).populate('student', 'name studentId');

  const flags = [];
  for (let i = 0; i < submissions.length; i += 1) {
    for (let j = i + 1; j < submissions.length; j += 1) {
      const { answerSimilarityPct, codeSimilarityPct, docSimilarityPct } = compareSubmissionPair(submissions[i], submissions[j]);
      const max = Math.max(answerSimilarityPct, codeSimilarityPct, docSimilarityPct);
      if (max >= HIGH_SIMILARITY_FLAG_PCT) {
        flags.push({
          studentA: submissions[i].student,
          studentB: submissions[j].student,
          answerSimilarityPct,
          codeSimilarityPct,
          docSimilarityPct,
        });
      }
    }
  }

  res.json({ success: true, flags, comparedPairs: (submissions.length * (submissions.length - 1)) / 2 });
});

module.exports = {
  evaluateOne,
  evaluateAll,
  getJobStatus,
  getEvaluation,
  listEvaluations,
  reviewEvaluation,
  publishResult,
  checkSimilarity,
};
