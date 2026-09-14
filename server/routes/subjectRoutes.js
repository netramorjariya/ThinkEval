const express = require('express');
const { listSubjects, createSubject, deleteSubject } = require('../controllers/subjectController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/', listSubjects);
router.post('/', restrictTo('admin'), createSubject);
router.delete('/:id', restrictTo('admin'), deleteSubject);

module.exports = router;
