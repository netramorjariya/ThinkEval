const aiService = require('./aiService');

const RUBRIC_SYSTEM_PROMPT = `You are an expert assessment designer who builds grading rubrics for scenario-based
university exams. Rubrics must be specific to the subject(s) and case study given, not generic. You always
respond with a single valid JSON object, no markdown, no commentary.`;

async function generateRubric({ subjects, caseStudy, totalMarks = 100 }) {
  const subjectNames = subjects.map((s) => s.name).join(', ');
  const userPrompt = `Design a grading rubric worth exactly ${totalMarks} total marks for an assessment covering
these subjects: ${subjectNames}.

CASE STUDY: ${caseStudy.title}
SCENARIO SUMMARY: ${caseStudy.scenario.slice(0, 800)}

Create 6-10 rubric criteria appropriate to these subjects and this scenario (e.g. for software engineering:
Scenario Understanding, Requirements, Architecture, Implementation, Testing; for DBMS: Schema Design,
Normalization, SQL, Transactions, Indexes; for web development: Frontend, Backend, API, Security, UI/UX).
Adapt criteria names to what was actually provided. The maxMarks across all criteria must sum to exactly ${totalMarks}.

Return JSON exactly as:
{
  "criteria": [ { "name": "criterion name", "description": "what earns full marks", "maxMarks": 15 } ]
}`;

  const { data, provider } = await aiService.generateStructured({
    systemPrompt: RUBRIC_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.6,
  });

  let criteria = Array.isArray(data.criteria) ? data.criteria : [];
  const sum = criteria.reduce((acc, c) => acc + (Number(c.maxMarks) || 0), 0);
  if (sum > 0 && sum !== totalMarks) {
    const factor = totalMarks / sum;
    criteria = criteria.map((c) => ({ ...c, maxMarks: Math.round((Number(c.maxMarks) || 0) * factor) }));
  }

  return { criteria, totalMarks, provider };
}

const EVALUATION_SYSTEM_PROMPT = `You are an expert, fair, rigorous academic evaluator. You grade a student's
submission strictly against the specific case study, scenario, rubric, and evidence given to you — never against
generic expectations. You cite concrete evidence for every important claim: quote the student's own answer text,
or reference a specific file path / excerpt from their project when available. If you cannot find supporting
evidence for a claim, you explicitly say "Evidence unavailable" instead of fabricating a file reference. You are
skeptical of answers that are generic, ChatGPT-boilerplate-sounding, or that ignore the specific numbers/constraints
given to this student. You always respond with a single valid JSON object, no markdown, no commentary.`;

function buildEvaluationPrompt({ assessment, caseStudy, rubric, resolvedQuestions, answers, projectAnalysis }) {
  const answersBlock = resolvedQuestions
    .map((rq) => {
      const ans = answers.find((a) => String(a.question) === String(rq.question));
      return `--- Question ${rq.order}: ${rq.questionText}
Student's answer:
${ans && ans.answerText ? ans.answerText : '[NO ANSWER PROVIDED]'}`;
    })
    .join('\n\n');

  const rubricBlock = rubric.criteria.map((c) => `- ${c.name} (max ${c.maxMarks}): ${c.description || ''}`).join('\n');

  let projectBlock = 'No project was submitted.';
  if (projectAnalysis && projectAnalysis.status === 'analyzed') {
    projectBlock = `Project static analysis (evidence available - do not claim you ran the code):
- Total files: ${projectAnalysis.totalFileCount}, source files: ${projectAnalysis.sourceFileCount}
- Languages detected: ${(projectAnalysis.languages || []).join(', ') || 'none'}
- Has package.json: ${projectAnalysis.hasPackageJson}, dependencies: ${(projectAnalysis.dependencies || []).slice(0, 20).join(', ') || 'none'}
- Has README: ${projectAnalysis.hasReadme}
- Has tests: ${projectAnalysis.hasTests}
- Has database-related files: ${projectAnalysis.hasDatabaseFiles}
- Has screenshots/UI evidence: ${projectAnalysis.hasScreenshots}
- README excerpt: ${(projectAnalysis.readmeExcerpt || '').slice(0, 600) || '[none]'}
- Key source file excerpts:
${(projectAnalysis.keySourceExcerpts || []).map((e) => `  File: ${e.filePath}\n  ${e.excerpt.slice(0, 500)}`).join('\n') || '  [none extracted]'}
- Warnings from static analysis: ${(projectAnalysis.warnings || []).join('; ') || 'none'}`;
  }

  return `Evaluate this student's submission strictly against the case study, rubric, and evidence below.

CASE STUDY: ${caseStudy.title}
BACKGROUND: ${caseStudy.background}
SCENARIO: ${caseStudy.scenario}
CONSTRAINTS: ${caseStudy.constraints.join('; ')}

GRADING RUBRIC (total ${rubric.totalMarks} marks):
${rubricBlock}

STUDENT ANSWERS:
${answersBlock}

PROJECT SUBMISSION EVIDENCE:
${projectBlock}

Instructions:
- Score each rubric criterion out of its maxMarks, with a short reasoning citing specific evidence (quote the
  student's text or reference a file path from the project evidence above).
- overallScore must equal the sum of criterion scores, out of ${rubric.totalMarks}.
- List strengths and weaknesses as short, specific bullet points (not generic).
- List concrete recommendations for improvement.
- List any missing requirements from the scenario that the student did not address.
- List technical issues found in the project evidence, if any.
- Provide an evidence array: for each major claim, state the claim, the source (a quote or file path), and whether
  it is directly verifiable from what was given to you (verified: true) or not (verified: false, and note
  "Evidence unavailable" as source if nothing supports it).
- If screenshots/UI evidence exists (hasScreenshots true), provide a uiEvaluation with a 0-10 score, pros, and cons
  based only on the filenames/structure available; otherwise set uiEvaluation.applicable to false and do not invent details.
- Provide per-question scores (perQuestion) referencing the question order, out of a reasonable share of total marks.
- Give a confidenceScore 0-100 reflecting how certain you are in this evaluation given the evidence quality.
- Set manualReviewRecommended to true (with manualReviewReasons) if the submission is incomplete, ambiguous, uses
  a valid-but-unusual approach, or evidence is insufficient to grade confidently.

Return JSON exactly as:
{
  "overallScore": number,
  "criteria": [ { "name": "string", "maxMarks": number, "scoreAwarded": number, "reasoning": "string" } ],
  "strengths": ["string"],
  "weaknesses": ["string"],
  "recommendations": ["string"],
  "scenarioCompliance": "string summary of how well the scenario's requirements were addressed",
  "missingRequirements": ["string"],
  "technicalIssues": ["string"],
  "evidence": [ { "claim": "string", "source": "string", "verified": boolean } ],
  "uiEvaluation": { "applicable": boolean, "score": number, "pros": ["string"], "cons": ["string"] },
  "perQuestion": [ { "questionOrder": number, "scoreAwarded": number, "maxMarks": number, "reasoning": "string" } ],
  "confidenceScore": number,
  "manualReviewRecommended": boolean,
  "manualReviewReasons": ["string"]
}`;
}

async function evaluateSubmission({ assessment, caseStudy, rubric, resolvedQuestions, answers, projectAnalysis, questionsById }) {
  const userPrompt = buildEvaluationPrompt({ assessment, caseStudy, rubric, resolvedQuestions, answers, projectAnalysis });

  const { data, provider } = await aiService.generateStructured({
    systemPrompt: EVALUATION_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.3,
  });

  const perQuestion = (Array.isArray(data.perQuestion) ? data.perQuestion : []).map((pq) => {
    const rq = resolvedQuestions.find((r) => r.order === pq.questionOrder);
    return {
      question: rq ? rq.question : undefined,
      scoreAwarded: Number(pq.scoreAwarded) || 0,
      maxMarks: Number(pq.maxMarks) || 0,
      reasoning: pq.reasoning || '',
    };
  });

  return {
    ai: {
      overallScore: Number(data.overallScore) || 0,
      criteria: (Array.isArray(data.criteria) ? data.criteria : []).map((c) => ({
        name: c.name,
        maxMarks: Number(c.maxMarks) || 0,
        scoreAwarded: Number(c.scoreAwarded) || 0,
        reasoning: c.reasoning || '',
      })),
      strengths: Array.isArray(data.strengths) ? data.strengths : [],
      weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
      recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
      scenarioCompliance: data.scenarioCompliance || '',
      missingRequirements: Array.isArray(data.missingRequirements) ? data.missingRequirements : [],
      technicalIssues: Array.isArray(data.technicalIssues) ? data.technicalIssues : [],
      evidence: Array.isArray(data.evidence) ? data.evidence : [],
      uiEvaluation: data.uiEvaluation || { applicable: false },
      perQuestion,
      confidenceScore: Number(data.confidenceScore) || 0,
      manualReviewRecommended: Boolean(data.manualReviewRecommended),
      manualReviewReasons: Array.isArray(data.manualReviewReasons) ? data.manualReviewReasons : [],
      rawModelOutput: data,
      evaluatedAt: new Date(),
      provider,
    },
  };
}

module.exports = { generateRubric, evaluateSubmission };
