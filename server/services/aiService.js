const gemini = require('./geminiService');
const groq = require('./groqService');

class AiGenerationError extends Error {
  constructor(message, causes) {
    super(message);
    this.causes = causes;
  }
}

/**
 * Tries Gemini first, falls back to Groq if configured. Returns { data, provider }.
 * Throws AiGenerationError if both providers fail or neither is configured.
 */
async function generateStructured({ systemPrompt, userPrompt, temperature }) {
  const causes = [];

  if (gemini.isConfigured()) {
    try {
      const data = await gemini.generateJson({ systemPrompt, userPrompt, temperature });
      return { data, provider: 'gemini' };
    } catch (err) {
      causes.push(`gemini: ${err.message}`);
    }
  } else {
    causes.push('gemini: not configured');
  }

  if (groq.isConfigured()) {
    try {
      const data = await groq.generateJson({ systemPrompt, userPrompt, temperature });
      return { data, provider: 'groq' };
    } catch (err) {
      causes.push(`groq: ${err.message}`);
    }
  } else {
    causes.push('groq: not configured');
  }

  // The API response only ever shows the generic message above — log the real per-provider
  // reasons server-side so failures (missing key, invalid key, bad model name, quota, etc.) are
  // diagnosable from the terminal. Provider error messages never contain the API key itself.
  console.error('[aiService] All AI providers failed:', causes.join(' | '));

  throw new AiGenerationError('AI generation temporarily unavailable. Please retry.', causes);
}

module.exports = { generateStructured, AiGenerationError };
