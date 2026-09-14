const express = require('express');
const { adminAnalytics, evaluatorAnalytics } = require('../controllers/analyticsController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.get('/admin', protect, restrictTo('admin'), adminAnalytics);
router.get('/evaluator', protect, restrictTo('admin', 'evaluator'), evaluatorAnalytics);

module.exports = router;
