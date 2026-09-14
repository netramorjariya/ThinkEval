const fs = require('fs');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const StudentAssignment = require('../models/StudentAssignment');
const Submission = require('../models/Submission');
const Question = require('../models/Question');
const Evaluation = require('../models/Evaluation');
const Result = require('../models/Result');
const { gradeMcqSubmission } = require('../services/mcqGrader');
const projectAnalyzer = require('../services/projectAnalyzer');

const VALID_OPTION_KEYS = ['A', 'B', 'C', 'D'];

const listAssignments = asyncHandler(async (req, res) => {
  const assignments = await StudentAssignment.find({ student: req.user._id })
    .populate({ path: 'assessment', populate: [{ path: 'subjects' }, { path: 'caseStudy' }] })
    .sort({ createdAt: -1 });
  res.json({ success: true, assignments });
});

const getAssignment = asyncHandler(async (req, res) => {
  const assignment = await StudentAssignment.findById(req.params.id).populate({
    path: 'assessment',
    populate: [{ path: 'subjects' }, { path: 'caseStudy' }],
  });
  if (!assignment) throw new ApiError(404, 'Assignment not found.');
  if (String(assignment.student) !== String(req.user._id)) {
    throw new ApiError(403, 'You do not have access to this assignment.');
  }

  if (assignment.status === 'assigned') {
    assignment.status = 'in_progress';
    assignment.startedAt = new Date();
    await assignment.save();
  }

  res.json({ success: true, assignment });
});

const autosaveAssignment = asyncHandler(async (req, res) => {
  const assignment = await StudentAssignment.findById(req.params.id);
  if (!assignment) throw new ApiError(404, 'Assignment not found.');
  if (String(assignment.student) !== String(req.user._id)) {
    throw new ApiError(403, 'You do not have access to this assignment.');
  }
  if (['submitted', 'evaluated', 'published'].includes(assignment.status)) {
    throw new ApiError(400, 'This assessment has already been submitted.');
  }

  const { answers, timeRemainingSeconds } = req.body;
  assignment.autosave = {
    answers: Array.isArray(answers)
      ? answers.map((a) => {
          const key = VALID_OPTION_KEYS.includes(String(a.selectedOption).toUpperCase())
            ? String(a.selectedOption).toUpperCase()
            : '';
          return {
            question: a.question,
            selectedOption: key,
            answerText: key,
            markedForReview: !!a.markedForReview,
          };
        })
      : assignment.autosave.answers,
    lastSavedAt: new Date(),
    timeRemainingSeconds,
  };
  await assignment.save();
  res.json({ success: true, lastSavedAt: assignment.autosave.lastSavedAt });
});

const submitAssignment = asyncHandler(async (req, res) => {
  const assignment = await StudentAssignment.findById(req.params.id).populate('assessment');
  if (!assignment) throw new ApiError(404, 'Assignment not found.');
  if (String(assignment.student) !== String(req.user._id)) {
    throw new ApiError(403, 'You do not have access to this assignment.');
  }
  if (['submitted', 'evaluated', 'published'].includes(assignment.status)) {
    throw new ApiError(400, 'This assessment has already been submitted.');
  }

  let rawAnswers = [];
  if (req.body.answers) {
    try {
      rawAnswers = typeof req.body.answers === 'string' ? JSON.parse(req.body.answers) : req.body.answers;
    } catch {
      throw new ApiError(400, 'Invalid answers payload.');
    }
  } else {
    rawAnswers = assignment.autosave.answers.map((a) => ({ question: a.question, selectedOption: a.selectedOption }));
  }
  if (!Array.isArray(rawAnswers)) throw new ApiError(400, 'answers must be an array.');

  const answers = rawAnswers.map((a) => {
    const key = VALID_OPTION_KEYS.includes(String(a.selectedOption).toUpperCase())
      ? String(a.selectedOption).toUpperCase()
      : '';
    return { question: a.question, selectedOption: key, answerText: key };
  });

  const isLate = assignment.dueAt && new Date() > new Date(assignment.dueAt);

  // Upsert on the assignment so a student who already submitted a project (or submits one later)
  // shares the same Submission document instead of creating a second, disconnected record.
  const submission = await Submission.findOneAndUpdate(
    { assignment: assignment._id },
    {
      $set: {
        assignment: assignment._id,
        assessment: assignment.assessment._id,
        student: req.user._id,
        answers,
        status: isLate ? 'late' : 'submitted',
        submittedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // ---------------------------------------------------------
  // Automatic, deterministic MCQ grading — no AI call involved.
  // ---------------------------------------------------------
  const questionIds = assignment.resolvedQuestions.map((rq) => rq.question);
  const questions = await Question.find({ _id: { $in: questionIds } }).select('+correctAnswer +explanation');
  const graded = gradeMcqSubmission({ questions, answers });

  const evaluation = await Evaluation.create({
    submission: submission._id,
    assessment: assignment.assessment._id,
    student: req.user._id,
    ai: {
      overallScore: graded.finalScore,
      perQuestion: graded.perQuestion,
      confidenceScore: 100,
      manualReviewRecommended: false,
      evaluatedAt: new Date(),
      provider: 'system',
    },
    review: {
      status: 'approved',
      finalScore: graded.finalScore,
      reviewedAt: new Date(),
    },
    status: 'published',
  });

  const result = await Result.findOneAndUpdate(
    { student: req.user._id, assessment: assignment.assessment._id },
    {
      student: req.user._id,
      assessment: assignment.assessment._id,
      evaluation: evaluation._id,
      finalScore: graded.finalScore,
      maxScore: graded.maxScore,
      grade: graded.grade,
      totalQuestions: graded.totalQuestions,
      correctCount: graded.correctCount,
      publishedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  // Grading is immediate and deterministic, so the assignment goes straight to published —
  // there is no evaluator review step for MCQ assessments.
  assignment.status = 'published';
  assignment.submission = submission._id;
  await assignment.save();

  res.status(201).json({ success: true, submission, result });
});

// Project submission is a deliberately separate workflow from the MCQ exam above — a student can
// submit their project before, after, or independently of taking the MCQ exam for the same assignment.
const submitProject = asyncHandler(async (req, res) => {
  const assignment = await StudentAssignment.findById(req.params.id).populate('assessment');
  if (!assignment) throw new ApiError(404, 'Assignment not found.');
  if (String(assignment.student) !== String(req.user._id)) {
    throw new ApiError(403, 'You do not have access to this assignment.');
  }
  if (!assignment.assessment.requiresProject) {
    throw new ApiError(400, 'This assessment does not require a project submission.');
  }

  const existing = await Submission.findOne({ assignment: assignment._id });
  if (existing && existing.projectStatus !== 'not_submitted') {
    throw new ApiError(400, 'You have already submitted a project for this assessment.');
  }

  if (!req.file) throw new ApiError(400, 'A project ZIP file is required.');

  let projectAnalysis;
  try {
    projectAnalysis = { ...projectAnalyzer.analyzeProjectZip(req.file.path), status: 'analyzed' };
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    throw err;
  }

  const project = {
    originalName: req.file.originalname,
    filePath: req.file.path,
    sizeBytes: req.file.size,
    uploadedAt: new Date(),
  };

  const submission = await Submission.findOneAndUpdate(
    { assignment: assignment._id },
    {
      $set: {
        assignment: assignment._id,
        assessment: assignment.assessment._id,
        student: req.user._id,
        project,
        projectAnalysis,
        projectStatus: 'submitted',
        projectSubmittedAt: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(201).json({ success: true, submission });
});

module.exports = { listAssignments, getAssignment, autosaveAssignment, submitAssignment, submitProject };
