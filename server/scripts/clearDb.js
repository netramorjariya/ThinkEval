require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Explicit, opt-in only. Never called automatically by the app or seed script.
const COLLECTIONS_TO_CLEAR = [
  'users',
  'subjects',
  'syllabi',
  'assessments',
  'casestudies',
  'questions',
  'rubrics',
  'studentassignments',
  'submissions',
  'evaluations',
  'results',
];

async function waitForConnection() {
  return new Promise((resolve, reject) => {
    if (mongoose.connection.readyState === 1) return resolve();
    mongoose.connection.once('connected', resolve);
    mongoose.connection.once('error', reject);
    setTimeout(() => reject(new Error('Timed out connecting to MongoDB.')), 15000);
  });
}

async function clearDb() {
  connectDB();
  await waitForConnection();

  console.log(`[clear-db] Connected to ${mongoose.connection.name}. Clearing collections...`);
  for (const name of COLLECTIONS_TO_CLEAR) {
    const result = await mongoose.connection.db.collection(name).deleteMany({});
    console.log(`[clear-db] ${name}: removed ${result.deletedCount} document(s)`);
  }
  console.log('[clear-db] Done.');
  await mongoose.disconnect();
}

clearDb().catch((err) => {
  console.error('[clear-db] Failed:', err.message);
  process.exit(1);
});
