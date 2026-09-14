const express = require('express');
const { listSubmissions, getSubmission, downloadProject, evaluateProject } = require('../controllers/submissionController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/', listSubmissions);
router.get('/:id', getSubmission);
router.get('/:id/project/download', downloadProject);
router.patch('/:id/project-evaluation', restrictTo('admin', 'evaluator'), evaluateProject);

module.exports = router;
