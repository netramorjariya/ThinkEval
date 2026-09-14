const express = require('express');
const { listResults, getStudentResult, getResultDetail, downloadReport } = require('../controllers/resultController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/', listResults);
router.get('/student/:studentId', getStudentResult);
router.get('/:id', getResultDetail);
router.get('/:id/report', downloadReport);

module.exports = router;
