const Groq = require('groq-sdk');

let client = null;
function getClient() {
  if (!process.env.GROQ_API_KEY) return null;
  if (!client) client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return client;
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const arrStart = candidate.indexOf('[');
  let sliceStart = start;
  if (arrStart !== -1 && (start === -1 || arrStart < start)) sliceStart = arrStart;
  if (sliceStart === -1) throw new Error('No JSON object found in Groq response');
  const end = candidate.lastIndexOf(sliceStart === arrStart ? ']' : '}');
  const jsonSlice = candidate.slice(sliceStart, end + 1);
  return JSON.parse(jsonSlice);
}

async function generateJson({ systemPrompt, userPrompt, temperature = 0.9 }) {
  const groq = getClient();
  if (!groq) throw new Error('GROQ_API_KEY is not configured');

  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    response_format: { type: 'json_object' },
  });

  const text = completion.choices[0].message.content;
  return extractJson(text);
}

module.exports = { generateJson, isConfigured: () => Boolean(process.env.GROQ_API_KEY) };
