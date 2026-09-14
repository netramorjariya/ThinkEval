const express = require('express');
const { uploadSyllabus, getSyllabus, listSyllabi, analyzeSyllabus, deleteSyllabus } = require('../controllers/syllabusController');
const { protect, restrictTo } = require('../middleware/auth');
const { syllabusUpload } = require('../middleware/upload');

const router = express.Router();

router.use(protect, restrictTo('admin'));
router.get('/', listSyllabi);
router.post('/upload', syllabusUpload.single('file'), uploadSyllabus);
router.get('/:id', getSyllabus);
router.post('/:id/analyze', analyzeSyllabus);
router.delete('/:id', deleteSyllabus);

module.exports = router;
