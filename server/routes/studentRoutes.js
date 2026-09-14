const express = require('express');
const { listAssignments, getAssignment, autosaveAssignment, submitAssignment, submitProject } = require('../controllers/studentController');
const { protect, restrictTo } = require('../middleware/auth');
const { projectUpload } = require('../middleware/upload');

const router = express.Router();

router.use(protect, restrictTo('student'));
router.get('/assignments', listAssignments);
router.get('/assignments/:id', getAssignment);
router.patch('/assignments/:id/autosave', autosaveAssignment);
router.post('/assignments/:id/submit', submitAssignment);
router.post('/assignments/:id/submit-project', projectUpload.single('project'), submitProject);

module.exports = router;
