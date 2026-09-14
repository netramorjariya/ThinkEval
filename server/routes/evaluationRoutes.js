const express = require('express');
const {
  evaluateOne,
  evaluateAll,
  getJobStatus,
  getEvaluation,
  listEvaluations,
  reviewEvaluation,
  publishResult,
  checkSimilarity,
} = require('../controllers/evaluationController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect, restrictTo('admin', 'evaluator'));
router.get('/', listEvaluations);
router.post('/evaluate-all', evaluateAll);
router.get('/job/:jobId', getJobStatus);
router.get('/similarity/:assessmentId', checkSimilarity);
router.post('/:submissionId', evaluateOne);
router.get('/:id', getEvaluation);
router.patch('/:id/review', reviewEvaluation);
router.post('/:id/publish', publishResult);

module.exports = router;
