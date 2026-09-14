const aiService = require('./aiService');

const SYSTEM_PROMPT = `You are an expert assessment designer who creates realistic, industry-style case studies for
university-level scenario-based examinations. Your case studies read like a real consulting brief or industry
problem statement, never like a textbook question. You combine concepts across multiple subjects when given
multiple syllabi so students must apply cross-disciplinary reasoning. You always respond with a single valid
JSON object, no markdown, no commentary.`;

function buildUserPrompt({ subjectsSummary, difficulty }) {
  return `Create ONE realistic, difficult, scenario-based case study for a student assessment.

SUBJECTS AND KEY TOPICS INVOLVED:
${subjectsSummary}

TARGET DIFFICULTY: ${difficulty}

Requirements:
- The case study must describe a believable organization, product, or situation (e.g. a startup, hospital system,
  e-commerce company, fintech platform) with real-world constraints, conflicting requirements, and incomplete information.
- If more than one subject is listed, the scenario MUST require applying concepts from ALL listed subjects together,
  not subjects treated in isolation.
- Do NOT write anything that resembles a dictionary definition or a "what is X" prompt.
- Include specific numeric or contextual details that make the situation concrete (these will later be personalized per student).
- Include stakeholders (e.g. roles like "CTO", "doctors", "operations manager") and at least 3 explicit constraints
  or trade-offs the student must reason about.

Return a JSON object with exactly this schema:
{
  "title": "short punchy case study title",
  "background": "2-4 sentences describing the organization/context",
  "scenario": "detailed paragraph(s) describing the current problem, symptoms, and complications the organization faces",
  "subjectsInvolved": ["Subject Name 1", "Subject Name 2"],
  "crossSubjectTopics": ["topic 1", "topic 2", "topic 3"],
  "constraints": ["constraint 1", "constraint 2", "constraint 3"],
  "stakeholders": ["role 1", "role 2"]
}`;
}

async function generateCaseStudy({ subjects, difficulty }) {
  const subjectsSummary = subjects
    .map((s) => {
      const topics = (s.analysis?.topics || []).slice(0, 12).join(', ');
      const skills = (s.analysis?.practicalSkills || []).slice(0, 8).join(', ');
      return `- ${s.name}: Topics [${topics}]. Practical skills [${skills}]`;
    })
    .join('\n');

  const { data, provider } = await aiService.generateStructured({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt({ subjectsSummary, difficulty }),
    temperature: 1.0,
  });

  return {
    caseStudy: {
      title: data.title,
      background: data.background,
      scenario: data.scenario,
      subjectsInvolved: Array.isArray(data.subjectsInvolved) ? data.subjectsInvolved : [],
      crossSubjectTopics: Array.isArray(data.crossSubjectTopics) ? data.crossSubjectTopics : [],
      constraints: Array.isArray(data.constraints) ? data.constraints : [],
      stakeholders: Array.isArray(data.stakeholders) ? data.stakeholders : [],
      rawModelOutput: data,
    },
    provider,
  };
}

module.exports = { generateCaseStudy };
