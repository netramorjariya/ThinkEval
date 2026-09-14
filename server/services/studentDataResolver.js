const { makeSeededRng, seededInt, seededPick, buildSeed } = require('../utils/seededRandom');

/**
 * dataTemplate is an array like:
 * [{ key: "users", type: "int", min: 1000, max: 5000 },
 *  { key: "region", type: "pick", options: ["APAC", "EMEA", "US-East"] }]
 *
 * Resolves it deterministically for a given assessmentId+studentId+questionOrder seed.
 */
function resolveTemplate(dataTemplate, seedString) {
  const rng = makeSeededRng(seedString);
  const resolved = {};
  for (const field of dataTemplate || []) {
    if (!field || !field.key) continue;
    if (field.type === 'int') {
      resolved[field.key] = seededInt(rng, field.min ?? 1, field.max ?? 100);
    } else if (field.type === 'pick' && Array.isArray(field.options) && field.options.length) {
      resolved[field.key] = seededPick(rng, field.options);
    } else if (field.type === 'float') {
      const min = field.min ?? 0;
      const max = field.max ?? 1;
      const decimals = field.decimals ?? 2;
      resolved[field.key] = Number((rng() * (max - min) + min).toFixed(decimals));
    }
  }
  return resolved;
}

function interpolate(text, resolvedData) {
  return (text || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(resolvedData, key) ? String(resolvedData[key]) : match;
  });
}

/** Builds the per-student resolved question list for an assignment. */
function resolveQuestionsForStudent({ assessmentId, studentId, questions }) {
  const assignmentSeed = buildSeed(assessmentId, studentId);
  const resolvedQuestions = questions.map((q) => {
    const seed = buildSeed(assessmentId, studentId, `q${q.order}`);
    const studentData = resolveTemplate(q.dataTemplate, seed);
    const questionText = interpolate(q.questionText, studentData);
    return {
      question: q._id,
      order: q.order,
      questionText,
      studentData,
      type: q.type,
      maxMarks: q.maxMarks,
      // MCQ options only — correctAnswer/explanation are select:false on the Question model
      // and must never reach the student before submission.
      options: q.type === 'mcq' ? q.options : undefined,
    };
  });
  return { seed: assignmentSeed, resolvedQuestions };
}

module.exports = { resolveTemplate, interpolate, resolveQuestionsForStudent };
