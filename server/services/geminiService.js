const { GoogleGenerativeAI } = require('@google/generative-ai');

let client = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return client;
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const arrStart = candidate.indexOf('[');
  let sliceStart = start;
  if (arrStart !== -1 && (start === -1 || arrStart < start)) sliceStart = arrStart;
  if (sliceStart === -1) throw new Error('No JSON object found in Gemini response');
  const end = candidate.lastIndexOf(sliceStart === arrStart ? ']' : '}');
  const jsonSlice = candidate.slice(sliceStart, end + 1);
  return JSON.parse(jsonSlice);
}

async function generateJson({ systemPrompt, userPrompt, temperature = 0.9 }) {
  const genAI = getClient();
  if (!genAI) throw new Error('GEMINI_API_KEY is not configured');

  const model = genAI.getGenerativeModel({
    // gemini-2.0-flash was retired by Google (404 "no longer available") — gemini-3.6-flash is
    // the currently supported default when GEMINI_MODEL isn't set.
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
    },
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  return extractJson(text);
}

module.exports = { generateJson, isConfigured: () => Boolean(process.env.GEMINI_API_KEY) };
