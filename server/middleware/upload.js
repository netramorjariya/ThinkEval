const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function makeStorage(subdir) {
  const dest = path.join(UPLOAD_ROOT, subdir);
  ensureDir(dest);
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const unique = crypto.randomBytes(8).toString('hex');
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${unique}${ext}`);
    },
  });
}

const maxSizeMb = Number(process.env.MAX_FILE_SIZE_MB || 25);

const syllabusUpload = multer({
  storage: makeStorage('syllabus'),
  limits: { fileSize: maxSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new ApiError(400, 'Only PDF, DOCX, and TXT syllabus files are supported.'));
    }
    cb(null, true);
  },
});

const projectUpload = multer({
  storage: makeStorage('projects'),
  limits: { fileSize: maxSizeMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.zip') {
      return cb(new ApiError(400, 'Only ZIP project archives are supported.'));
    }
    cb(null, true);
  },
});

module.exports = { syllabusUpload, projectUpload, UPLOAD_ROOT };
