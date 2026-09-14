require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

const DEMO_PASSWORD = 'Passw0rd!';

const demoUsers = [
  { name: 'Ava Administrator', email: 'admin@evalforge.ai', role: 'admin' },
  { name: 'Ethan Evaluator', email: 'evaluator@evalforge.ai', role: 'evaluator' },
  { name: 'Riya Sharma', email: 'riya.sharma@evalforge.ai', role: 'student', studentId: 'STU2026001', course: 'B.Tech CSE', semester: '6', section: 'A' },
  { name: 'Arjun Mehta', email: 'arjun.mehta@evalforge.ai', role: 'student', studentId: 'STU2026002', course: 'B.Tech CSE', semester: '6', section: 'A' },
  { name: 'Diya Patel', email: 'diya.patel@evalforge.ai', role: 'student', studentId: 'STU2026003', course: 'B.Tech CSE', semester: '6', section: 'B' },
  { name: 'Kabir Singh', email: 'kabir.singh@evalforge.ai', role: 'student', studentId: 'STU2026004', course: 'B.Tech CSE', semester: '6', section: 'B' },
  { name: 'Sneha Rao', email: 'sneha.rao@evalforge.ai', role: 'student', studentId: 'STU2026005', course: 'B.Tech CSE', semester: '6', section: 'A' },
];

function waitForConnection() {
  return new Promise((resolve, reject) => {
    if (mongoose.connection.readyState === 1) return resolve();
    mongoose.connection.once('connected', resolve);
    mongoose.connection.once('error', reject);
    setTimeout(() => reject(new Error('Timed out connecting to MongoDB.')), 15000);
  });
}

async function seed() {
  connectDB();
  await waitForConnection();

  for (const u of demoUsers) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`[seed] Skipping existing user: ${u.email}`);
      continue;
    }
    await User.create({ ...u, password: DEMO_PASSWORD });
    console.log(`[seed] Created ${u.role}: ${u.email}`);
  }

  console.log('\n[seed] Done. Demo credentials (password for all): ' + DEMO_PASSWORD);
  console.log('[seed] Admin:     admin@evalforge.ai');
  console.log('[seed] Evaluator: evaluator@evalforge.ai');
  console.log('[seed] Students:  riya.sharma@evalforge.ai, arjun.mehta@evalforge.ai, diya.patel@evalforge.ai, kabir.singh@evalforge.ai, sneha.rao@evalforge.ai');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
