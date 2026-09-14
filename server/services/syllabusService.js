const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const ApiError = require('../utils/ApiError');
const aiService = require('./aiService');

async function extractText(filePath, fileType) {
  const buffer = fs.readFileSync(filePath);

  if (fileType === 'pdf') {
    const result = await pdfParse(buffer);
    return result.text.trim();
  }
  if (fileType === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  }
  if (fileType === 'txt') {
    return buffer.toString('utf-8').trim();
  }
  throw new ApiError(400, `Unsupported syllabus file type: ${fileType}`);
}

function detectFileType(originalName) {
  const ext = path.extname(originalName).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (ext === '.docx') return 'docx';
  if (ext === '.txt') return 'txt';
  throw new ApiError(400, 'Unsupported file type');
}

const SYSTEM_PROMPT = `You are an expert academic curriculum analyst. You analyze course syllabi and extract
structured, precise information used to generate difficult, practical, scenario-based assessments.
You never fabricate topics that are not reasonably implied by the syllabus text.
Always respond with a single JSON object matching exactly the schema requested by the user. Do not include markdown, commentary, or explanations outside the JSON.`;

async function analyzeSyllabus({ subjectName, extractedText }) {
  const truncated = extractedText.slice(0, 18000);

  const userPrompt = `Analyze the following syllabus for the subject "${subjectName}".

SYLLABUS TEXT:
"""
${truncated}
"""

Return a JSON object with this exact schema:
{
  "topics": ["main topic 1", "main topic 2", ...],
  "subtopics": [ { "topic": "main topic name", "items": ["subtopic 1", "subtopic 2"] } ],
  "learningObjectives": ["objective 1", "objective 2", ...],
  "difficultyMapping": { "topic name": "EASY|MEDIUM|HARD|VERY_HARD|EXPERT" },
  "practicalSkills": ["skill 1", "skill 2", ...],
  "topicRelationships": [ { "from": "topic A", "to": "topic B", "relationship": "short description of how they relate" } ]
}

Requirements:
- Extract real topics and subtopics, not just headings copied verbatim.
- Identify learning objectives even if not explicitly labeled.
- Map practical, hands-on skills a student should be able to apply (not just recall).
- Identify at least 3 meaningful relationships between topics where possible.
- Be thorough but concise. Return valid JSON only.`;

  const { data, provider } = await aiService.generateStructured({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.4,
  });

  return {
    analysis: {
      topics: Array.isArray(data.topics) ? data.topics : [],
      subtopics: Array.isArray(data.subtopics) ? data.subtopics : [],
      learningObjectives: Array.isArray(data.learningObjectives) ? data.learningObjectives : [],
      difficultyMapping: data.difficultyMapping || {},
      practicalSkills: Array.isArray(data.practicalSkills) ? data.practicalSkills : [],
      topicRelationships: Array.isArray(data.topicRelationships) ? data.topicRelationships : [],
    },
    provider,
  };
}

module.exports = { extractText, detectFileType, analyzeSyllabus };
