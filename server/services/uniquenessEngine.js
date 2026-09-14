function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function shingles(tokens, n = 3) {
  const set = new Set();
  for (let i = 0; i <= tokens.length - n; i += 1) {
    set.add(tokens.slice(i, i + n).join(' '));
  }
  return set;
}

/** Jaccard similarity between two texts using word 3-shingles. Returns 0..1. */
function textSimilarity(a, b) {
  const shinglesA = shingles(tokenize(a));
  const shinglesB = shingles(tokenize(b));
  if (shinglesA.size === 0 || shinglesB.size === 0) return 0;
  let intersection = 0;
  for (const s of shinglesA) {
    if (shinglesB.has(s)) intersection += 1;
  }
  const union = shinglesA.size + shinglesB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const SIMILARITY_THRESHOLD = 0.55;

/** Returns true if candidate is too similar to any existing text. */
function isDuplicate(candidateText, existingTexts, threshold = SIMILARITY_THRESHOLD) {
  return existingTexts.some((existing) => textSimilarity(candidateText, existing) >= threshold);
}

/** Finds the max similarity score of candidate against a list of existing texts. */
function maxSimilarity(candidateText, existingTexts) {
  let max = 0;
  for (const existing of existingTexts) {
    const sim = textSimilarity(candidateText, existing);
    if (sim > max) max = sim;
  }
  return max;
}

/** Compares two students' answer text and project readme/source excerpts for plagiarism signals. */
function compareSubmissionPair(subA, subB) {
  const answerTextA = (subA.answers || []).map((a) => a.answerText).join('\n');
  const answerTextB = (subB.answers || []).map((a) => a.answerText).join('\n');
  const codeTextA = ((subA.projectAnalysis?.keySourceExcerpts) || []).map((e) => e.excerpt).join('\n');
  const codeTextB = ((subB.projectAnalysis?.keySourceExcerpts) || []).map((e) => e.excerpt).join('\n');
  const docTextA = subA.projectAnalysis?.readmeExcerpt || '';
  const docTextB = subB.projectAnalysis?.readmeExcerpt || '';

  return {
    answerSimilarityPct: Math.round(textSimilarity(answerTextA, answerTextB) * 100),
    codeSimilarityPct: codeTextA && codeTextB ? Math.round(textSimilarity(codeTextA, codeTextB) * 100) : 0,
    docSimilarityPct: docTextA && docTextB ? Math.round(textSimilarity(docTextA, docTextB) * 100) : 0,
  };
}

const HIGH_SIMILARITY_FLAG_PCT = 70;

module.exports = {
  textSimilarity,
  isDuplicate,
  maxSimilarity,
  SIMILARITY_THRESHOLD,
  compareSubmissionPair,
  HIGH_SIMILARITY_FLAG_PCT,
};
