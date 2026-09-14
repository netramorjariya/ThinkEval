const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');
const Result = require('../models/Result');
const Question = require('../models/Question');
const StudentAssignment = require('../models/StudentAssignment');

const adminAnalytics = asyncHandler(async (req, res) => {
  const [totalStudents, totalEvaluators, activeAssessments, submittedProjects, pendingEvaluations, completedEvaluations, results] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'evaluator' }),
    Assessment.countDocuments({ status: 'published' }),
    Submission.countDocuments(),
    Evaluation.countDocuments({ status: { $in: ['pending', 'ai_evaluated'] } }),
    Evaluation.countDocuments({ status: { $in: ['reviewed', 'published'] } }),
    Result.find(),
  ]);

  const averageScore = results.length ? Math.round(results.reduce((sum, r) => sum + r.finalScore, 0) / results.length) : 0;

  const scoreDistribution = [
    { bucket: '0-40', count: results.filter((r) => r.finalScore < 40).length },
    { bucket: '40-60', count: results.filter((r) => r.finalScore >= 40 && r.finalScore < 60).length },
    { bucket: '60-75', count: results.filter((r) => r.finalScore >= 60 && r.finalScore < 75).length },
    { bucket: '75-90', count: results.filter((r) => r.finalScore >= 75 && r.finalScore < 90).length },
    { bucket: '90-100', count: results.filter((r) => r.finalScore >= 90).length },
  ];

  const assessments = await Assessment.find({ status: 'published' }).populate('subjects', 'name');
  const subjectPerformance = [];
  for (const a of assessments) {
    const assessmentResults = await Result.find({ assessment: a._id });
    if (assessmentResults.length === 0) continue;
    const avg = Math.round(assessmentResults.reduce((s, r) => s + r.finalScore, 0) / assessmentResults.length);
    subjectPerformance.push({
      subject: a.subjects.map((s) => s.name).join(' + '),
      assessment: a.title,
      averageScore: avg,
      submissions: assessmentResults.length,
    });
  }

  const assessmentCompletion = await Promise.all(
    assessments.map(async (a) => {
      const total = a.assignedStudents.length;
      const submitted = await Submission.countDocuments({ assessment: a._id });
      return { title: a.title, total, submitted, completionPct: total ? Math.round((submitted / total) * 100) : 0 };
    })
  );

  const topicScores = {};
  const questions = await Question.find({ assessment: { $in: assessments.map((a) => a._id) } });
  const evaluations = await Evaluation.find({ assessment: { $in: assessments.map((a) => a._id) }, status: { $in: ['ai_evaluated', 'reviewed', 'published'] } });
  for (const evalDoc of evaluations) {
    for (const pq of evalDoc.ai?.perQuestion || []) {
      const q = questions.find((qq) => String(qq._id) === String(pq.question));
      if (!q || !pq.maxMarks) continue;
      for (const topic of q.topics || []) {
        if (!topicScores[topic]) topicScores[topic] = { total: 0, max: 0 };
        topicScores[topic].total += pq.scoreAwarded || 0;
        topicScores[topic].max += pq.maxMarks || 0;
      }
    }
  }
  const topicWisePerformance = Object.entries(topicScores).map(([topic, v]) => ({
    topic,
    percentage: v.max ? Math.round((v.total / v.max) * 100) : 0,
  }));

  res.json({
    success: true,
    stats: {
      totalStudents,
      totalEvaluators,
      activeAssessments,
      submittedProjects,
      pendingEvaluations,
      completedEvaluations,
      averageScore,
    },
    charts: { scoreDistribution, subjectPerformance, assessmentCompletion, topicWisePerformance },
  });
});

const evaluatorAnalytics = asyncHandler(async (req, res) => {
  const assessments = await Assessment.find({ status: 'published' });
  const assessmentIds = assessments.map((a) => a._id);

  const [totalAssigned, pending, completed, results] = await Promise.all([
    StudentAssignment.countDocuments({ assessment: { $in: assessmentIds } }),
    Evaluation.countDocuments({ assessment: { $in: assessmentIds }, status: { $in: ['pending', 'ai_evaluated'] } }),
    Evaluation.countDocuments({ assessment: { $in: assessmentIds }, status: { $in: ['reviewed', 'published'] } }),
    Result.find({ assessment: { $in: assessmentIds } }),
  ]);

  const averageScore = results.length ? Math.round(results.reduce((s, r) => s + r.finalScore, 0) / results.length) : 0;

  const questions = await Question.find({ assessment: { $in: assessmentIds } });
  const evaluations = await Evaluation.find({ assessment: { $in: assessmentIds }, status: { $in: ['ai_evaluated', 'reviewed', 'published'] } });

  const questionStats = questions.map((q) => {
    const scores = [];
    for (const evalDoc of evaluations) {
      const pq = (evalDoc.ai?.perQuestion || []).find((p) => String(p.question) === String(q._id));
      if (pq && pq.maxMarks) scores.push((pq.scoreAwarded / pq.maxMarks) * 100);
    }
    const avgPct = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null;
    return {
      questionId: q._id,
      title: q.title,
      difficulty: q.difficulty,
      attempts: scores.length,
      averageScorePct: avgPct,
      suggestion: avgPct !== null && avgPct < 35 ? 'This question may be excessively difficult.' : null,
    };
  });

  res.json({
    success: true,
    stats: { totalAssigned, pendingEvaluations: pending, completedEvaluations: completed, averageScore },
    questionStats,
  });
});

module.exports = { adminAnalytics, evaluatorAnalytics };
