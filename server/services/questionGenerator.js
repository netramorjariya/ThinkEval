const aiService = require('./aiService');
const { textSimilarity, SIMILARITY_THRESHOLD } = require('./uniquenessEngine');

const SYSTEM_PROMPT = `You are an expert university examination question designer.

Your task is to generate high-quality multiple-choice questions (MCQs) strictly from the provided syllabus content.

IMPORTANT RULES:
1. Generate ONLY MCQ questions.
2. Every question must have exactly 4 options.
3. Options must use keys A, B, C, and D.
4. There must be exactly ONE correct answer.
5. The correctAnswer must be one of: A, B, C, D.
6. Questions must be based ONLY on the supplied syllabus/topics.
7. Do not introduce concepts that are not supported by the syllabus.
8. Avoid duplicate or highly similar questions.
9. Avoid questions where multiple options could reasonably be correct.
10. Questions should test understanding and application, not only memorization.
11. Use clear university-level language.
12. Create a mixture of EASY, MEDIUM and HARD questions when the requested difficulty is MIXED.
13. Every question must include a short explanation of why the correct answer is correct.
14. Do not include markdown.
15. Return ONLY one valid JSON object.
16. The JSON object must contain a "questions" array.

Each question MUST follow this structure:

{
  "title": "Short question title",
  "questionText": "Complete MCQ question",
  "type": "mcq",
  "difficulty": "EASY | MEDIUM | HARD | VERY_HARD | EXPERT",
  "topics": ["topic1", "topic2"],
  "constraints": [],
  "expectedSkills": ["skill1"],
  "evaluationCriteria": [],
  "evaluationParameters": [],
  "dataTemplate": [],
  "maxMarks": 1,
  "options": [
    { "key": "A", "text": "Option A" },
    { "key": "B", "text": "Option B" },
    { "key": "C", "text": "Option C" },
    { "key": "D", "text": "Option D" }
  ],
  "correctAnswer": "A",
  "explanation": "Explain why option A is correct."
}

Return ONLY:

{
  "questions": [...]
}`;

function buildUserPrompt({ subjectsSummary, difficulty, count }) {
  return `Generate ${count} multiple-choice questions based ONLY on the syllabus information provided below.

SUBJECTS AND SYLLABUS TOPICS:
${subjectsSummary}

TARGET DIFFICULTY:
${difficulty}

IMPORTANT:
- Generate exactly ${count} MCQs.
- Each question must have exactly 4 options: A, B, C, D.
- Only one option can be correct.
- The correctAnswer must be A, B, C, or D.
- Questions must be directly related to the supplied syllabus.
- Do not create questions from outside knowledge.
- Avoid duplicate questions.
- Include a clear explanation for every answer.
- Questions should test understanding/application where possible.

Return ONLY valid JSON using this structure:

{
  "questions": [
    {
      "title": "Short title",
      "questionText": "Question text",
      "type": "mcq",
      "difficulty": "MEDIUM",
      "topics": ["topic"],
      "constraints": [],
      "expectedSkills": ["skill"],
      "evaluationCriteria": [],
      "evaluationParameters": [],
      "dataTemplate": [],
      "maxMarks": 1,
      "options": [
        { "key": "A", "text": "..." },
        { "key": "B", "text": "..." },
        { "key": "C", "text": "..." },
        { "key": "D", "text": "..." }
      ],
      "correctAnswer": "A",
      "explanation": "Why A is correct."
    }
  ]
}`;
}

function isDefinitionOnly(questionText) {
  const t = questionText.trim().toLowerCase();
  const badPatterns = [
    /^what is /,
    /^define /,
    /^explain [a-z\s]+\.?$/,
    /^list the /,
    /^name the /,
  ];
  return badPatterns.some((re) => re.test(t)) && t.length < 120;
}

/**
 * Normalizes a question's evaluationParameters so their weights sum to exactly 100 and each
 * has a maxMarks derived from the question's total maxMarks. Rounding drift is absorbed by the
 * last parameter so maxMarks always sums exactly to the question's total.
 */
function validateAndNormalizeParameters(parameters, questionMaxMarks) {
  const clean = (Array.isArray(parameters) ? parameters : [])
    .filter((p) => p && p.name)
    .map((p) => ({
      name: String(p.name),
      description: p.description || '',
      weight: Number(p.weight) || 0,
      evaluationInstructions: p.evaluationInstructions || '',
    }))
    .filter((p) => p.weight > 0);

  if (clean.length === 0) {
    return [
      {
        name: 'Overall Quality',
        description: 'Overall correctness, reasoning, and fit to the scenario.',
        weight: 100,
        maxMarks: questionMaxMarks,
        evaluationInstructions: 'Evaluate holistically against the scenario and rubric.',
      },
    ];
  }

  const weightSum = clean.reduce((acc, p) => acc + p.weight, 0);
  const normalized = clean.map((p) => ({ ...p, weight: Math.round((p.weight / weightSum) * 100) }));

  // Fix rounding drift so weights sum to exactly 100.
  const drift = 100 - normalized.reduce((acc, p) => acc + p.weight, 0);
  normalized[normalized.length - 1].weight += drift;

  let marksAssigned = 0;
  const withMarks = normalized.map((p, i) => {
    if (i === normalized.length - 1) {
      const maxMarks = questionMaxMarks - marksAssigned;
      return { ...p, maxMarks };
    }
    const maxMarks = Math.round((questionMaxMarks * p.weight) / 100);
    marksAssigned += maxMarks;
    return { ...p, maxMarks };
  });

  return withMarks;
}

/**
 * Computes a 0-100 quality score for a generated question using heuristic checks.
 * This is intentionally rule-based (not another AI call) so it is fast, deterministic, and auditable.
 * MCQ questions use a lighter, type-appropriate checklist instead of the reasoning-prose checks below.
 */
function computeQualityScore(question) {
  if (question.type === 'mcq') {
    const checks = {
      hasFourOptions: Array.isArray(question.options) && question.options.length === 4,
      hasCorrectAnswer: Boolean(question.correctAnswer),
      hasExplanation: Boolean(question.explanation) && question.explanation.length > 10,
      hasScenarioContext: /\b(company|startup|system|hospital|platform|team|organization|application|scenario|client)\b/i.test(question.questionText || ''),
      sufficientLength: (question.questionText || '').length >= 60,
    };
    const weights = { hasFourOptions: 30, hasCorrectAnswer: 25, hasExplanation: 20, hasScenarioContext: 15, sufficientLength: 10 };
    let score = 0;
    for (const [key, weight] of Object.entries(weights)) if (checks[key]) score += weight;
    return { score, checks };
  }

  const checks = {
    hasScenarioContext: false,
    notDefinitionOnly: !isDefinitionOnly(question.questionText),
    hasReasoningVerbs: false,
    hasEvaluationCriteria: Array.isArray(question.evaluationCriteria) && question.evaluationCriteria.length >= 2,
    sufficientLength: (question.questionText || '').length >= 180,
    hasTopics: Array.isArray(question.topics) && question.topics.length >= 1,
    hasExpectedSkills: Array.isArray(question.expectedSkills) && question.expectedSkills.length >= 1,
    hasEvaluationParameters: Array.isArray(question.evaluationParameters) && question.evaluationParameters.length >= 2,
  };

  const reasoningVerbs = ['justify', 'design', 'evaluate', 'identify', 'propose', 'analyze', 'recommend', 'redesign', 'trade-off', 'compare', 'determine'];
  const lower = (question.questionText || '').toLowerCase();
  checks.hasReasoningVerbs = reasoningVerbs.some((v) => lower.includes(v));
  checks.hasScenarioContext = lower.length > 0 && /\b(company|startup|system|hospital|platform|team|organization|application|scenario|client)\b/.test(lower);

  const weights = {
    hasScenarioContext: 12,
    notDefinitionOnly: 22,
    hasReasoningVerbs: 18,
    hasEvaluationCriteria: 12,
    sufficientLength: 10,
    hasTopics: 7,
    hasExpectedSkills: 7,
    hasEvaluationParameters: 12,
  };

  let score = 0;
  for (const [key, weight] of Object.entries(weights)) {
    if (checks[key]) score += weight;
  }

  return { score, checks };
}

async function generateQuestionBatch({ caseStudy, subjects, difficulty, count = 6 }) {
  const subjectsSummary = subjects
    .map((s) => `- ${s.name}: ${(s.analysis?.topics || []).slice(0, 10).join(', ')}`)
    .join('\n');

  const { data, provider } = await aiService.generateStructured({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt({ caseStudy, subjectsSummary, difficulty, count }),
    temperature: 1.0,
  });

  const rawQuestions = Array.isArray(data.questions) ? data.questions : [];
  return { questions: rawQuestions, provider };
}

/** Filters out questions too similar to already-accepted ones in this batch. */
function dedupeAgainstExisting(candidateText, acceptedTexts) {
  return acceptedTexts.every((t) => textSimilarity(candidateText, t) < SIMILARITY_THRESHOLD);
}

module.exports = {
  generateQuestionBatch,
  computeQualityScore,
  dedupeAgainstExisting,
  isDefinitionOnly,
  validateAndNormalizeParameters,
};
