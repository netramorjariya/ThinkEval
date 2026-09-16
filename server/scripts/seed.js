require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

const DEMO_PASSWORD = 'Passw0rd!';

// Sample student accounts for local testing/demo purposes only. Real students use the
// public "Create an account" flow (see authController.register), which always forces
// role: 'student' regardless of what's submitted.
const demoStudents = [
  { name: 'Riya Sharma', email: 'riya.sharma@evalforge.ai', role: 'student', studentId: 'STU2026001', course: 'B.Tech CSE', semester: '6', section: 'A' },
  { name: 'Arjun Mehta', email: 'arjun.mehta@evalforge.ai', role: 'student', studentId: 'STU2026002', course: 'B.Tech CSE', semester: '6', section: 'A' },
  { name: 'Diya Patel', email: 'diya.patel@evalforge.ai', role: 'student', studentId: 'STU2026003', course: 'B.Tech CSE', semester: '6', section: 'B' },
  { name: 'Kabir Singh', email: 'kabir.singh@evalforge.ai', role: 'student', studentId: 'STU2026004', course: 'B.Tech CSE', semester: '6', section: 'B' },
  { name: 'Sneha Rao', email: 'sneha.rao@evalforge.ai', role: 'student', studentId: 'STU2026005', course: 'B.Tech CSE', semester: '6', section: 'A' },
];

// Predefined operator accounts. These are the only way admin/evaluator accounts get
// created — the public registration form and API can never produce them (role is
// hardcoded to 'student' there). Passwords come from env vars, never hardcoded, so they
// can differ per environment (local vs. production) and be rotated without a code change.
const predefinedAccounts = [
  { name: 'Netra', email: 'netra@evalforge.ai', role: 'admin', password: process.env.ADMIN_PASSWORD },
  { name: 'Evaluator', email: 'evaluator@evalforge.ai', role: 'evaluator', password: process.env.EVALUATOR_PASSWORD },
];

function waitForConnection() {
  return new Promise((resolve, reject) => {
    if (mongoose.connection.readyState === 1) return resolve();
    mongoose.connection.once('connected', resolve);
    mongoose.connection.once('error', reject);
    setTimeout(() => reject(new Error('Timed out connecting to MongoDB.')), 15000);
  });
}

// Idempotent upsert: never creates a duplicate. If the account already exists, its
// password is left untouched (so rotating ADMIN_PASSWORD/EVALUATOR_PASSWORD later and
// re-running the seed doesn't silently reset a password someone may have since changed);
// only name/role drift is corrected.
async function upsertPredefinedAccount({ name, email, role, password }) {
  if (!password) {
    throw new Error(
      `Missing password for predefined ${role} account (${email}). Set the ADMIN_PASSWORD / EVALUATOR_PASSWORD environment variable before seeding.`
    );
  }

  const existing = await User.findOne({ email });
  if (existing) {
    let changed = false;
    if (existing.role !== role) {
      existing.role = role;
      changed = true;
    }
    if (existing.name !== name) {
      existing.name = name;
      changed = true;
    }
    if (changed) await existing.save();
    console.log(`[seed] ${changed ? 'Updated' : 'Kept'} existing ${role}: ${email}`);
    return;
  }

  await User.create({ name, email, password, role });
  console.log(`[seed] Created ${role}: ${email}`);
}

async function seed() {
  connectDB();
  await waitForConnection();

  for (const account of predefinedAccounts) {
    await upsertPredefinedAccount(account);
  }

  for (const u of demoStudents) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`[seed] Skipping existing user: ${u.email}`);
      continue;
    }
    await User.create({ ...u, password: DEMO_PASSWORD });
    console.log(`[seed] Created ${u.role}: ${u.email}`);
  }

  console.log('\n[seed] Done.');
  console.log('[seed] Admin:     netra@evalforge.ai (password: ADMIN_PASSWORD env var)');
  console.log('[seed] Evaluator: evaluator@evalforge.ai (password: EVALUATOR_PASSWORD env var)');
  console.log(`[seed] Demo students (password: ${DEMO_PASSWORD}): riya.sharma@evalforge.ai, arjun.mehta@evalforge.ai, diya.patel@evalforge.ai, kabir.singh@evalforge.ai, sneha.rao@evalforge.ai`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
