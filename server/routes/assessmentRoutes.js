const express = require('express');
const {
  createAssessment,
  listAssessments,
  getAssessment,
  generateAssessment,
  publishAssessment,
  deleteAssessment,
  updateProjectRequirements,
} = require('../controllers/assessmentController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/', listAssessments);
router.post('/', restrictTo('admin'), createAssessment);
router.get('/:id', getAssessment);
router.post('/:id/generate', restrictTo('admin'), generateAssessment);
router.post('/:id/publish', restrictTo('admin'), publishAssessment);
router.patch('/:id/project-requirements', restrictTo('admin'), updateProjectRequirements);
router.delete('/:id', restrictTo('admin'), deleteAssessment);

module.exports = router;
