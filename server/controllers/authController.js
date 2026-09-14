const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');
const { signToken } = require('../utils/token');

const register = asyncHandler(async (req, res) => {
  // Email format, password complexity, and confirm-password match are already enforced by the
  // registerValidators chain in authRoutes.js — req.body.email arrives trimmed and lowercased.
  const { name, email, password, studentId, course, semester, section } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  // Public registration always creates a STUDENT account. Admin/Evaluator accounts
  // are created only via the seed script or the admin management page.
  const user = await User.create({
    name,
    email,
    password,
    role: 'student',
    studentId,
    course,
    semester,
    section,
  });

  const token = signToken(user);
  res.status(201).json({ success: true, token, user: user.toSafeObject() });
});

const login = asyncHandler(async (req, res) => {
  // Email format and password presence are already enforced by loginValidators in authRoutes.js —
  // req.body.email arrives trimmed and lowercased. Deliberately no password shape/length check
  // here: existing accounts may have passwords predating the current registration policy.
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password.');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'This account has been deactivated.');
  }

  const token = signToken(user);
  res.json({ success: true, token, user: user.toSafeObject() });
});

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user.toSafeObject() });
});

module.exports = { register, login, me };
