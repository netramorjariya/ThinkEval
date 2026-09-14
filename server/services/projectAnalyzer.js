const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const ApiError = require('../utils/ApiError');

const SOURCE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.php', '.rb', '.go', '.c', '.cpp', '.cs', '.html', '.css', '.sql'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const DB_HINT_PATTERNS = [/schema\.sql$/i, /\.sql$/i, /migrations?\//i, /prisma/i, /models?\//i, /\.db$/i, /\.sqlite/i];
const MAX_ENTRIES = 3000;
const MAX_EXCERPT_FILES = 5;
const MAX_EXCERPT_CHARS = 1200;

function languageFromExt(ext) {
  const map = {
    '.js': 'JavaScript', '.jsx': 'JavaScript (React)', '.ts': 'TypeScript', '.tsx': 'TypeScript (React)',
    '.py': 'Python', '.java': 'Java', '.php': 'PHP', '.rb': 'Ruby', '.go': 'Go', '.c': 'C',
    '.cpp': 'C++', '.cs': 'C#', '.html': 'HTML', '.css': 'CSS', '.sql': 'SQL',
  };
  return map[ext] || null;
}

/** Statically inspects an uploaded project ZIP without executing any code. */
function analyzeProjectZip(zipFilePath) {
  let zip;
  try {
    zip = new AdmZip(zipFilePath);
  } catch (err) {
    throw new ApiError(400, 'Uploaded file is not a valid ZIP archive.');
  }

  const entries = zip.getEntries();
  if (entries.length > MAX_ENTRIES) {
    throw new ApiError(400, 'Project archive has too many files to analyze safely.');
  }

  const warnings = [];
  const fileTree = [];
  const languagesSet = new Set();
  let hasPackageJson = false;
  let hasReadme = false;
  let hasTests = false;
  let hasDatabaseFiles = false;
  let hasScreenshots = false;
  let sourceFileCount = 0;
  let totalFileCount = 0;
  const dependencies = new Set();
  const keySourceExcerpts = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const entryName = entry.entryName.replace(/\\/g, '/');

    if (entryName.includes('..')) {
      warnings.push(`Skipped suspicious path in archive: ${entryName}`);
      continue;
    }

    totalFileCount += 1;
    fileTree.push(entryName);
    const ext = path.extname(entryName).toLowerCase();
    const base = path.basename(entryName).toLowerCase();

    if (base === 'package.json') hasPackageJson = true;
    if (/^readme(\.md|\.txt)?$/i.test(base)) hasReadme = true;
    if (/test|spec/i.test(entryName)) hasTests = true;
    if (DB_HINT_PATTERNS.some((re) => re.test(entryName))) hasDatabaseFiles = true;
    if (IMAGE_EXTENSIONS.includes(ext) && /screenshot|screens?|ui|preview/i.test(entryName)) hasScreenshots = true;

    const lang = languageFromExt(ext);
    if (lang) {
      languagesSet.add(lang);
      sourceFileCount += 1;
    }

    if (base === 'package.json') {
      try {
        const content = entry.getData().toString('utf-8');
        const pkg = JSON.parse(content);
        Object.keys(pkg.dependencies || {}).forEach((d) => dependencies.add(d));
        Object.keys(pkg.devDependencies || {}).forEach((d) => dependencies.add(d));
      } catch {
        warnings.push('package.json could not be parsed as valid JSON.');
      }
    }

    if (/^readme(\.md|\.txt)?$/i.test(base) && keySourceExcerpts.length < MAX_EXCERPT_FILES) {
      try {
        const content = entry.getData().toString('utf-8').slice(0, MAX_EXCERPT_CHARS);
        keySourceExcerpts.push({ filePath: entryName, excerpt: content });
      } catch {
        // ignore unreadable file
      }
    }
  }

  if (sourceFileCount > 0 && keySourceExcerpts.length < MAX_EXCERPT_FILES) {
    const sourceEntries = entries.filter((e) => !e.isDirectory && SOURCE_EXTENSIONS.includes(path.extname(e.entryName).toLowerCase()));
    for (const entry of sourceEntries.slice(0, MAX_EXCERPT_FILES - keySourceExcerpts.length)) {
      try {
        const content = entry.getData().toString('utf-8').slice(0, MAX_EXCERPT_CHARS);
        keySourceExcerpts.push({ filePath: entry.entryName, excerpt: content });
      } catch {
        // ignore unreadable/binary file
      }
    }
  }

  let readmeExcerpt = '';
  const readmeEntry = keySourceExcerpts.find((e) => /^readme/i.test(path.basename(e.filePath)));
  if (readmeEntry) readmeExcerpt = readmeEntry.excerpt;

  if (!hasPackageJson && !hasDatabaseFiles && sourceFileCount === 0) {
    warnings.push('No recognizable source files detected in the archive.');
  }

  return {
    status: 'analyzed',
    fileTree: fileTree.slice(0, 500),
    hasPackageJson,
    hasReadme,
    hasTests,
    hasDatabaseFiles,
    hasScreenshots,
    dependencies: Array.from(dependencies).slice(0, 100),
    languages: Array.from(languagesSet),
    sourceFileCount,
    totalFileCount,
    readmeExcerpt,
    keySourceExcerpts,
    warnings,
  };
}

module.exports = { analyzeProjectZip };
