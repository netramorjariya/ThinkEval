const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Plain-text length/complexity is enforced at the request layer (see authRoutes' validators) —
    // minlength here only guards against an empty/near-empty value slipping through some other
    // path. It must stay well below the stored bcrypt hash length (60 chars) so re-saving an
    // existing user (whose password field already holds the hash) never fails validation.
    password: { type: String, required: true, minlength: 4, select: false },
    role: { type: String, enum: ['admin', 'evaluator', 'student'], required: true, default: 'student' },
    // student-only fields
    studentId: { type: String, trim: true },
    course: { type: String, trim: true },
    semester: { type: String, trim: true },
    section: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.index({ studentId: 1 }, { sparse: true });

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
