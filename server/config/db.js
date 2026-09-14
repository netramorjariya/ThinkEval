const mongoose = require('mongoose');

const RETRY_INTERVAL_MS = 10000;

/**
 * Connects to MongoDB and keeps retrying in the background on failure/disconnect,
 * rather than crashing the whole process. Combined with the requireDb middleware,
 * this lets the API stay up and return a clean 503 while the database is unreachable
 * instead of ever falling back to in-memory/fake data.
 */
function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in environment variables');
  }
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    console.log(`[db] connected -> ${mongoose.connection.name}`);
  });
  mongoose.connection.on('disconnected', () => {
    console.error('[db] disconnected — API will return 503 for database-backed routes until reconnected.');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[db] connection error:', err.message);
  });

  function attempt() {
    mongoose.connect(uri).catch((err) => {
      console.error(`[db] failed to connect (${err.message}). Retrying in ${RETRY_INTERVAL_MS / 1000}s...`);
      setTimeout(attempt, RETRY_INTERVAL_MS);
    });
  }

  return attempt();
}

/** Express middleware: returns a clean 503 for any /api route while MongoDB is not connected. */
function requireDb(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, message: 'Database connection unavailable.' });
  }
  next();
}

module.exports = connectDB;
module.exports.requireDb = requireDb;
