const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Assessment = require('../models/Assessment');
const Subject = require('../models/Subject');
const Syllabus = require('../models/Syllabus');
const Question = require('../models/Question');
const CaseStudy = require('../models/CaseStudy');
const Rubric = require('../models/Rubric');
const StudentAssignment = require('../models/StudentAssignment');
const User = require('../models/User');
const aiService = require('../services/aiService');
const { runGenerationPipeline, MAX_SYLLABI } = require('../services/assessmentPipeline');
const { resolveQuestionsForStudent } = require('../services/studentDataResolver');

const MAX_SUBJECTS = 3;

const createAssessment = asyncHandler(async (req, res) => {
  const { title, description, subjectIds, difficulty, durationMinutes, totalQuestions, marksPerQuestion, questionDistribution } = req.body;

  if (!title) throw new ApiError(400, 'Title is required.');
  if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
    throw new ApiError(400, 'At least one subject is required.');
  }
  if (subjectIds.length > MAX_SUBJECTS) {
    throw new ApiError(400, 'Maximum 3 subjects allowed per assessment.');
  }

  const subjects = await Subject.find({ _id: { $in: subjectIds } });
  if (subjects.length !== subjectIds.length) {
    throw new ApiError(404, 'One or more selected subjects were not found.');
  }

  const syllabi = await Syllabus.find({ subject: { $in: subjectIds } });
  const missing = subjects.filter((s) => !syllabi.find((sy) => String(sy.subject) === String(s._id)));
  if (missing.length > 0) {
    throw new ApiError(400, `Missing syllabus upload for: ${missing.map((s) => s.name).join(', ')}`);
  }
  const unanalyzed = syllabi.filter((sy) => sy.status !== 'analyzed');
  if (unanalyzed.length > 0) {
    throw new ApiError(400, 'All selected subjects must have an analyzed syllabus before creating an assessment.');
  }
  // Hard backend cap — a generation run may never draw from more than MAX_SYLLABI syllabi.
  if (syllabi.length > MAX_SYLLABI) {
    throw new ApiError(400, `Maximum ${MAX_SYLLABI} syllabi allowed per assessment.`);
  }

  // --- Total question count -------------------------------------------------
  // Defaults to 20 when omitted so the older Assessments.jsx creation path (which never sends
  // this field) keeps working unchanged.
  const totalQuestionsNum = totalQuestions === undefined ? 20 : Number(totalQuestions);
  if (!Number.isInteger(totalQuestionsNum) || totalQuestionsNum < 1 || totalQuestionsNum > 100) {
    throw new ApiError(400, 'Total number of MCQs must be a whole number between 1 and 100.');
  }

  // --- Marks per question -----------------------------------------------------
  const marksPerQuestionNum = marksPerQuestion === undefined ? 5 : Number(marksPerQuestion);
  if (!Number.isFinite(marksPerQuestionNum) || marksPerQuestionNum <= 0) {
    throw new ApiError(400, 'Marks per MCQ must be greater than 0.');
  }

  // --- Question distribution across subjects -----------------------------------
  let distribution;
  if (Array.isArray(questionDistribution) && questionDistribution.length > 0) {
    distribution = questionDistribution.map((d) => ({ subject: d.subject, count: Number(d.count) }));
    if (distribution.some((d) => !d.subject || !Number.isInteger(d.count) || d.count < 0)) {
      throw new ApiError(400, 'Each question distribution entry must reference a subject with a non-negative whole number count.');
    }
    const subjectIdSet = new Set(subjectIds.map(String));
    const invalidRefs = distribution.filter((d) => !subjectIdSet.has(String(d.subject)));
    if (invalidRefs.length > 0) {
      throw new ApiError(400, 'Question distribution references a subject that was not selected for this exam.');
    }
    const distributionSum = distribution.reduce((sum, d) => sum + d.count, 0);
    if (distributionSum !== totalQuestionsNum) {
      throw new ApiError(400, `Question distribution must sum to exactly ${totalQuestionsNum} (got ${distributionSum}).`);
    }
  } else {
    // Backward-compatible default: split the total evenly across the selected subjects.
    const base = Math.floor(totalQuestionsNum / subjectIds.length);
    const remainder = totalQuestionsNum % subjectIds.length;
    distribution = subjectIds.map((id, i) => ({ subject: id, count: base + (i < remainder ? 1 : 0) }));
  }

  const assessment = await Assessment.create({
    title,
    description,
    subjects: subjectIds,
    syllabi: syllabi.map((s) => s._id),
    difficulty: difficulty || 'HARD',
    durationMinutes: durationMinutes || 90,
    requiresProject: false,
    totalQuestions: totalQuestionsNum,
    marksPerQuestion: marksPerQuestionNum,
    totalMarks: totalQuestionsNum * marksPerQuestionNum,
    questionDistribution: distribution,
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, assessment });
});

const listAssessments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role === 'student') {
    filter.status = 'published';
    filter.assignedStudents = req.user._id;
  }
  const assessments = await Assessment.find(filter).populate('subjects').sort({ createdAt: -1 });
  res.json({ success: true, assessments });
});

const getAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id)
    .populate('subjects')
    .populate('caseStudy')
    .populate('rubric');
  if (!assessment) throw new ApiError(404, 'Assessment not found.');

  // Students may only ever view a published assessment they were assigned — and never through
  // this admin/evaluator endpoint's question payload, which can include correctAnswer below.
  if (req.user.role === 'student') {
    const isAssigned = assessment.assignedStudents.some((id) => String(id) === String(req.user._id));
    if (assessment.status !== 'published' || !isAssigned) {
      throw new ApiError(403, 'You do not have access to this assessment.');
    }
  }

  let questionQuery = Question.find({ assessment: assessment._id }).populate('subject', 'name').sort({ order: 1 });
  // Correct answers/explanations are only ever surfaced for admin/evaluator review — never to students.
  if (req.user.role !== 'student') {
    questionQuery = questionQuery.select('+correctAnswer +explanation');
  }
  const questions = await questionQuery;

  res.json({ success: true, assessment, questions });
});

const generateAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);
  if (!assessment) throw new ApiError(404, 'Assessment not found.');
  if (assessment.status === 'generating') {
    throw new ApiError(409, 'Generation is already in progress for this assessment.');
  }

  try {
    const result = await runGenerationPipeline(assessment._id);
    res.json({ success: true, assessment: result.assessment, caseStudy: result.caseStudy, questions: result.questions });
  } catch (err) {
    if (err instanceof aiService.AiGenerationError) {
      throw new ApiError(503, err.message);
    }
    throw err;
  }
});

const publishAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);
  if (!assessment) throw new ApiError(404, 'Assessment not found.');
  if (assessment.status !== 'generated') {
    throw new ApiError(400, 'Assessment must be successfully generated before publishing.');
  }

  const questions = await Question.find({ assessment: assessment._id })
    .select('+correctAnswer +explanation')
    .sort({ order: 1 });
  if (questions.length === 0) throw new ApiError(400, 'No questions found for this assessment.');

  // Defensive re-validation — publishing must never expose a broken MCQ to students.
  const invalidQuestions = questions.filter(
    (q) =>
      q.type !== 'mcq' ||
      !Array.isArray(q.options) ||
      q.options.length !== 4 ||
      !['A', 'B', 'C', 'D'].includes(String(q.correctAnswer).toUpperCase())
  );
  if (invalidQuestions.length > 0) {
    throw new ApiError(
      400,
      `Cannot publish: ${invalidQuestions.length} question(s) are invalid (must be an MCQ with exactly 4 options and a correct answer). Regenerate the assessment.`
    );
  }

  let studentIds = req.body.studentIds;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    const allStudents = await User.find({ role: 'student', isActive: true }).select('_id');
    studentIds = allStudents.map((s) => s._id.toString());
  }
  if (studentIds.length === 0) {
    throw new ApiError(400, 'No students available to assign this assessment to.');
  }

  const dueAt = new Date(Date.now() + assessment.durationMinutes * 60 * 1000 * 24);

  const ops = studentIds.map((studentId) => {
    const { seed, resolvedQuestions } = resolveQuestionsForStudent({
      assessmentId: assessment._id,
      studentId,
      questions,
    });
    return {
      updateOne: {
        filter: { assessment: assessment._id, student: studentId },
        update: {
          $setOnInsert: {
            assessment: assessment._id,
            student: studentId,
            seed,
            resolvedQuestions,
            status: 'assigned',
            dueAt,
          },
        },
        upsert: true,
      },
    };
  });

  await StudentAssignment.bulkWrite(ops);

  assessment.status = 'published';
  assessment.publishedAt = new Date();
  assessment.assignedStudents = studentIds;
  await assessment.save();

  res.json({ success: true, assessment, assignedCount: studentIds.length });
});

const deleteAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);
  if (!assessment) throw new ApiError(404, 'Assessment not found.');
  if (assessment.status === 'published') {
    throw new ApiError(400, 'Cannot delete a published assessment.');
  }
  await Question.deleteMany({ assessment: assessment._id });
  await CaseStudy.deleteMany({ assessment: assessment._id });
  await Rubric.deleteMany({ assessment: assessment._id });
  await assessment.deleteOne();
  res.json({ success: true, message: 'Assessment deleted.' });
});

// Lets an admin attach a project brief to an already-published exam, opting it into the separate
// project-submission workflow. Toggling this is all that's needed for it to appear to students —
// they were already assigned to the exam when it was published.
const updateProjectRequirements = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);
  if (!assessment) throw new ApiError(404, 'Assessment not found.');

  const { projectRequirements, requiresProject } = req.body;
  if (typeof projectRequirements === 'string') assessment.projectRequirements = projectRequirements;
  if (typeof requiresProject === 'boolean') assessment.requiresProject = requiresProject;
  await assessment.save();

  res.json({ success: true, assessment });
});

module.exports = {
  createAssessment,
  listAssessments,
  getAssessment,
  generateAssessment,
  publishAssessment,
  deleteAssessment,
  updateProjectRequirements,
};
