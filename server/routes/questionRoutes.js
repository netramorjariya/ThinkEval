const express = require('express');
const { listQuestions } = require('../controllers/questionController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect, restrictTo('admin', 'evaluator'));
router.get('/:assessmentId', listQuestions);

module.exports = router;
