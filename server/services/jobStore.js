const crypto = require('crypto');

// In-memory job tracker for long-running background operations like "Evaluate All".
// Sufficient for a single-process MVP; a real deployment would back this with Redis/a queue.
const jobs = new Map();

function createJob(total) {
  const id = crypto.randomBytes(12).toString('hex');
  jobs.set(id, {
    id,
    total,
    completed: 0,
    failed: 0,
    status: 'running',
    results: [],
    startedAt: new Date(),
    finishedAt: null,
  });
  return id;
}

function getJob(id) {
  return jobs.get(id);
}

function updateJob(id, patch) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, patch);
}

function pushResult(id, result) {
  const job = jobs.get(id);
  if (!job) return;
  job.results.push(result);
  job.completed += 1;
  if (!result.success) job.failed += 1;
  if (job.completed >= job.total) {
    job.status = 'completed';
    job.finishedAt = new Date();
  }
}

module.exports = { createJob, getJob, updateJob, pushResult };
