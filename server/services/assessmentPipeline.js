const Assessment = require('../models/Assessment');
const Question = require('../models/Question');
const Syllabus = require('../models/Syllabus');

const questionGenerator = require('./questionGenerator');
const { isDuplicate } = require('./uniquenessEngine');

const QUESTION_COUNT = 20;
const MAX_REGENERATION_ATTEMPTS = 3;
const MAX_SYLLABI = 3;

/**
 * Checks the shape Gemini must return for every MCQ: exactly 4 options keyed A-D, a correct
 * answer among them, and a non-trivial explanation. Purely structural — quality scoring is
 * separate (see questionGenerator.computeQualityScore).
 */
function isStructurallyValidMcq(raw) {
  if (!raw || !raw.questionText) return false;
  if (raw.type !== 'mcq') return false;
  if (!Array.isArray(raw.options) || raw.options.length !== 4) return false;

  const optionKeys = raw.options.map((option) => String(option.key).toUpperCase());
  const requiredKeys = ['A', 'B', 'C', 'D'];
  if (!requiredKeys.every((key) => optionKeys.includes(key))) return false;

  const hasEmptyOption = raw.options.some((option) => !option || !option.text || String(option.text).trim().length === 0);
  if (hasEmptyOption) return false;

  const correctAnswer = String(raw.correctAnswer || '').toUpperCase();
  if (!requiredKeys.includes(correctAnswer)) return false;

  if (!raw.explanation || String(raw.explanation).trim().length < 10) return false;

  return true;
}

/**
 * Repeatedly calls Gemini for a single subject until `count` valid, non-duplicate, high-quality
 * MCQs have been accepted (or attempts run out). Scoped to one subject's syllabus at a time so
 * Gemini never mixes topics across subjects into the same batch.
 */
async function generateForSubject({ subjectForPrompt, difficulty, count }) {
  const acceptedTexts = [];
  const acceptedRaw = [];

  for (let attempt = 0; attempt <= MAX_REGENERATION_ATTEMPTS && acceptedRaw.length < count; attempt += 1) {
    const remaining = count - acceptedRaw.length;
    // Ask for a few extra questions because some may fail duplicate/quality/format validation.
    const requestCount = Math.min(remaining + 5, 30);

    const { questions: rawQuestions } = await questionGenerator.generateQuestionBatch({
      subjects: subjectForPrompt,
      difficulty,
      count: requestCount,
    });

    if (!Array.isArray(rawQuestions)) continue;

    for (const raw of rawQuestions) {
      if (acceptedRaw.length >= count) break;

      if (!isStructurallyValidMcq(raw)) continue;
      if (isDuplicate(raw.questionText, acceptedTexts)) continue;

      const { score, checks } = questionGenerator.computeQualityScore(raw);
      if (score < 55) continue;

      acceptedTexts.push(raw.questionText);
      acceptedRaw.push({ raw, score, checks });
    }
  }

  return acceptedRaw;
}

/**
 * Full MCQ generation pipeline:
 *
 * Syllabus (per subject)
 *   ↓
 * Gemini AI (called once per subject, respecting that subject's requested question count)
 *   ↓
 * Quality + duplicate validation
 *   ↓
 * Save Questions (tagged with their source subject)
 *   ↓
 * Assessment becomes "generated"
 *
 * Total questions, marks-per-question, and the per-subject split all come from the assessment
 * document (set at creation time — see assessmentController.createAssessment), defaulting to the
 * original 20-question / 5-marks-each / even-split behavior when a legacy assessment doesn't have
 * them set.
 */
async function runGenerationPipeline(assessmentId) {
  const assessment = await Assessment.findById(assessmentId).populate('subjects');

  if (!assessment) {
    throw new Error('Assessment not found');
  }

  assessment.status = 'generating';
  assessment.generationError = '';
  await assessment.save();

  try {
    // ---------------------------------------------------------
    // 1. Get syllabi attached to this assessment
    // ---------------------------------------------------------
    if (assessment.syllabi.length > MAX_SYLLABI) {
      throw new Error(
        `A maximum of ${MAX_SYLLABI} syllabi can be used to generate an assessment.`
      );
    }

    const syllabi = await Syllabus.find({
      _id: { $in: assessment.syllabi },
    });

    if (!syllabi.length) {
      throw new Error(
        'No syllabus found for this assessment. Please upload and analyze the syllabus first.'
      );
    }

    // ---------------------------------------------------------
    // 2. Resolve total questions, marks, and the per-subject distribution
    // ---------------------------------------------------------
    const totalQuestions = assessment.totalQuestions || QUESTION_COUNT;
    const marksPerQuestion = assessment.marksPerQuestion || 5;

    let distribution =
      Array.isArray(assessment.questionDistribution) && assessment.questionDistribution.length > 0
        ? assessment.questionDistribution.map((d) => ({ subjectId: String(d.subject), count: d.count }))
        : assessment.subjects.map((s, i) => {
            const base = Math.floor(totalQuestions / assessment.subjects.length);
            const remainder = totalQuestions % assessment.subjects.length;
            return { subjectId: String(s._id), count: base + (i < remainder ? 1 : 0) };
          });

    const distributionSum = distribution.reduce((sum, d) => sum + d.count, 0);
    if (distributionSum !== totalQuestions) {
      throw new Error(
        `Question distribution (${distributionSum}) does not match the total number of questions (${totalQuestions}).`
      );
    }

    // Make sure every subject with a non-zero share has an analyzed syllabus.
    const missingSyllabus = distribution
      .filter((d) => d.count > 0)
      .map((d) => {
        const subjectDoc = assessment.subjects.find((s) => String(s._id) === d.subjectId);
        const syllabus = syllabi.find((s) => String(s.subject) === d.subjectId);
        return { subjectDoc, syllabus };
      })
      .filter(({ syllabus }) => !syllabus || !Array.isArray(syllabus.analysis?.topics) || syllabus.analysis.topics.length === 0);

    if (missingSyllabus.length > 0) {
      throw new Error(
        `Syllabus analysis is missing for: ${missingSyllabus.map(({ subjectDoc }) => subjectDoc?.name || 'a selected subject').join(', ')}`
      );
    }

    // ---------------------------------------------------------
    // 3. Generate MCQs per subject — Gemini is called once per subject with that subject's
    //    exact requested count, never mixing syllabi across subjects into one batch.
    // ---------------------------------------------------------
    const perSubjectAccepted = [];

    for (const { subjectId, count } of distribution) {
      if (count <= 0) continue;

      const subjectDoc = assessment.subjects.find((s) => String(s._id) === subjectId);
      const syllabus = syllabi.find((s) => String(s.subject) === subjectId);

      const accepted = await generateForSubject({
        subjectForPrompt: [{ name: subjectDoc.name, analysis: syllabus.analysis }],
        difficulty: assessment.difficulty,
        count,
      });

      if (accepted.length < count) {
        throw new Error(
          `AI generated only ${accepted.length} valid MCQs out of ${count} required for "${subjectDoc.name}". Please try generating again.`
        );
      }

      perSubjectAccepted.push({ subjectDoc, accepted: accepted.slice(0, count) });
    }

    // ---------------------------------------------------------
    // 4. Remove any previous generated questions
    // ---------------------------------------------------------
    await Question.deleteMany({
      assessment: assessment._id,
    });

    // ---------------------------------------------------------
    // 5. Save the requested total, each tagged with its source subject and configured marks
    // ---------------------------------------------------------
    const savedQuestions = [];
    let order = 0;

    for (const { subjectDoc, accepted } of perSubjectAccepted) {
      for (const { raw, score, checks } of accepted) {
        order += 1;
        const correctAnswer = String(raw.correctAnswer).toUpperCase();

        const questionDoc = {
          assessment: assessment._id,
          subject: subjectDoc._id,

          order,

          title: raw.title || `Question ${order}`,

          questionText: String(raw.questionText).trim(),

          type: 'mcq',

          difficulty: raw.difficulty || assessment.difficulty || 'MEDIUM',

          topics: Array.isArray(raw.topics) ? raw.topics : [],

          constraints: Array.isArray(raw.constraints) ? raw.constraints : [],

          expectedSkills: Array.isArray(raw.expectedSkills) ? raw.expectedSkills : [],

          evaluationCriteria: [],

          evaluationParameters: [],

          dataTemplate: [],

          maxMarks: marksPerQuestion,

          qualityScore: score,

          qualityChecks: checks,

          options: raw.options.map((option) => ({
            key: String(option.key).toUpperCase(),
            text: String(option.text).trim(),
          })),

          correctAnswer,

          explanation: String(raw.explanation).trim(),

          // No negative marking
          negativeMarkingPerWrong: 0,
        };

        const question = await Question.create(questionDoc);
        savedQuestions.push(question);
      }
    }

    // ---------------------------------------------------------
    // 6. Update assessment
    // ---------------------------------------------------------
    assessment.status = 'generated';

    // MCQ assessments don't require AI evaluation/rubrics.
    assessment.rubric = undefined;
    assessment.totalMarks = totalQuestions * marksPerQuestion;

    await assessment.save();

    // ---------------------------------------------------------
    // 7. Return generated assessment
    // ---------------------------------------------------------
    return {
      assessment,
      questions: savedQuestions,
      totalQuestions: savedQuestions.length,
      totalMarks: assessment.totalMarks,
    };
  } catch (err) {
    assessment.status = 'failed';

    assessment.generationError =
      err.message ||
      'AI generation temporarily unavailable. Please retry.';

    await assessment.save();

    throw err;
  }
}

module.exports = {
  runGenerationPipeline,
  QUESTION_COUNT,
  MAX_SYLLABI,
};
