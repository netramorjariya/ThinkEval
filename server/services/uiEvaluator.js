/**
 * UI/UX evaluation is generated as part of the single evaluationEngine.evaluateSubmission() call
 * (see the `uiEvaluation` field in its prompt/output) rather than as a second AI round-trip, since the
 * evaluator needs the same project evidence context. This module exposes a small helper used by
 * controllers/services to decide whether UI evidence exists before trusting the AI's uiEvaluation block.
 */
function hasUiEvidence(projectAnalysis) {
  return Boolean(projectAnalysis && projectAnalysis.status === 'analyzed' && projectAnalysis.hasScreenshots);
}

function sanitizeUiEvaluation(uiEvaluation, projectAnalysis) {
  if (!hasUiEvidence(projectAnalysis)) {
    return { applicable: false, score: undefined, pros: [], cons: [] };
  }
  return {
    applicable: Boolean(uiEvaluation?.applicable),
    score: typeof uiEvaluation?.score === 'number' ? uiEvaluation.score : undefined,
    pros: Array.isArray(uiEvaluation?.pros) ? uiEvaluation.pros : [],
    cons: Array.isArray(uiEvaluation?.cons) ? uiEvaluation.cons : [],
  };
}

module.exports = { hasUiEvidence, sanitizeUiEvaluation };
