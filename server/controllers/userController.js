const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

const listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  const users = await User.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, users: users.map((u) => u.toSafeObject()) });
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, studentId, course, semester, section } = req.body;
  if (!name || !email || !password || !role) {
    throw new ApiError(400, 'Name, email, password, and role are required.');
  }
  if (!['admin', 'evaluator', 'student'].includes(role)) {
    throw new ApiError(400, 'Invalid role.');
  }
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new ApiError(409, 'An account with this email already exists.');

  const user = await User.create({ name, email, password, role, studentId, course, semester, section });
  res.status(201).json({ success: true, user: user.toSafeObject() });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');
  if (typeof req.body.isActive === 'boolean') user.isActive = req.body.isActive;
  await user.save();
  res.json({ success: true, user: user.toSafeObject() });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found.');
  if (String(user._id) === String(req.user._id)) throw new ApiError(400, 'You cannot delete your own account.');
  await user.deleteOne();
  res.json({ success: true, message: 'User deleted.' });
});

module.exports = { listUsers, createUser, updateUserStatus, deleteUser };
