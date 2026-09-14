const express = require('express');
const { body } = require('express-validator');
const { register, login, me } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

// New-account password policy — enforced on registration only. Existing accounts (created before
// this policy, or via the admin/seed scripts) keep whatever password they already have; login
// never re-validates password shape against this regex, only that one was supplied.
const PASSWORD_POLICY_RE = /^(?=.{4,6}$)(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;
const PASSWORD_POLICY_MESSAGE =
  'Password must be 4-6 characters and include an uppercase letter, a number, and a special character.';

const registerValidators = [
  body('name').trim().notEmpty().withMessage('Name is required.'),
  body('email').trim().toLowerCase().isEmail().withMessage('Please enter a valid email address.'),
  body('password').matches(PASSWORD_POLICY_RE).withMessage(PASSWORD_POLICY_MESSAGE),
  body('confirmPassword')
    .optional({ checkFalsy: true })
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match.'),
];

const loginValidators = [
  body('email').trim().toLowerCase().isEmail().withMessage('Please enter a valid email address.'),
  body('password').notEmpty().withMessage('Please enter your password.'),
];

router.post('/register', registerValidators, validate, register);
router.post('/login', loginValidators, validate, login);
router.get('/me', protect, me);

module.exports = router;
