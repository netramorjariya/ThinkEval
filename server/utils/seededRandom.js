const crypto = require('crypto');

function hashStringToInt(str) {
  const hash = crypto.createHash('sha256').update(str).digest();
  return hash.readUInt32BE(0);
}

/** Mulberry32 deterministic PRNG. Returns a function generating floats in [0,1). */
function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSeededRng(seedString) {
  return mulberry32(hashStringToInt(seedString));
}

function seededInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function seededPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function buildSeed(assessmentId, studentId, salt = '') {
  return `${assessmentId}:${studentId}:${salt}`;
}

module.exports = { makeSeededRng, seededInt, seededPick, buildSeed, hashStringToInt };
