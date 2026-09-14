# EvalForge AI

**AI-Powered Scenario-Based Student Assessment & Evaluation**

EvalForge AI turns a course syllabus into a difficult, realistic, scenario-based assessment — a different case study
data set for every student — and then uses AI to evaluate submitted answers and projects against a scenario-specific
rubric, with evidence, confidence scoring, and mandatory human evaluator review before results are published.

This is positioned as **AI-resilient practical assessment**, not a claim of being "AI-proof."

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Folder Structure](#folder-structure)
- [Installation](#installation)
- [Environment Setup](#environment-setup)
- [MongoDB Setup](#mongodb-setup)
- [Gemini / Groq Setup](#gemini--groq-setup)
- [Running the App](#running-the-app)
- [Seed Data & Demo Credentials](#seed-data--demo-credentials)
- [API Overview](#api-overview)
- [Assessment Generation Flow](#assessment-generation-flow)
- [Evaluation Flow](#evaluation-flow)

## Features

- Role-based access for **Admin**, **Evaluator**, and **Student** (JWT + bcrypt, no Firebase/Supabase).
- Admin uploads up to **3 subject syllabi** per assessment (PDF/DOCX/TXT), which the AI analyzes into topics,
  subtopics, learning objectives, difficulty mapping, and practical skills.
- AI generates a realistic, industry-style **cross-subject case study** and a set of difficult, scenario-based
  questions — never plain definition/recall questions.
- **Student-specific data**: each student gets deterministically randomized numbers/parameters (seeded from
  `assessmentId + studentId`), so the same question concept looks different per student and is reproducible.
- A local **uniqueness engine** (Jaccard shingling) rejects near-duplicate generated questions.
- Students take assessments with a countdown timer, autosave, question navigation, mark-for-review, and
  auto-submit; they upload a project ZIP that is statically analyzed (no code execution).
- Evaluators can evaluate one submission or click **Evaluate All**, which runs a backend job evaluating every
  eligible submission against a dynamic, AI-generated rubric — with strengths, weaknesses, recommendations,
  evidence, UI/UX evaluation (when screenshots are present), and an AI confidence score.
- Evaluators **review and can override** AI marks (with a required reason), then publish final results.
- Similarity/plagiarism signal comparison between submissions (flagged, not accused).
- Admin/Evaluator analytics dashboards (score distribution, topic performance, question difficulty) and a
  downloadable PDF evaluation report per student.

## Architecture

```
Admin uploads syllabus -> text extraction -> AI syllabus analysis -> case study generation ->
scenario + rubric generation -> question generation -> quality/uniqueness validation ->
per-student data resolution -> publish to students

Student submits -> project static analysis -> AI evaluation against rubric + evidence ->
evaluator review/override -> publish -> student sees detailed result
```

## Tech Stack

**Frontend:** React 19, Vite, React Router, Tailwind CSS v4, Axios, Recharts, Lucide icons, react-hot-toast
**Backend:** Node.js, Express
**Database:** MongoDB + Mongoose
**Auth:** JWT + bcrypt
**AI:** Gemini API (primary), Groq API (optional fallback) — all AI calls happen server-side only
**Files:** Local disk storage (`server/uploads`), `pdf-parse` / `mammoth` / `adm-zip` for document & ZIP processing

## Folder Structure

```
root/
├── client/        React + Vite frontend (pages/admin, pages/evaluator, pages/student, ...)
├── server/
│   ├── controllers/   route handlers
│   ├── routes/        Express routers
│   ├── models/        Mongoose schemas
│   ├── middleware/     auth, upload, error handling
│   ├── services/       AI providers, syllabus parsing, case study/question generation,
│   │                    uniqueness engine, evaluation engine, project analyzer, report generator
│   ├── utils/          seeded RNG, JWT signing, grading, async handler
│   ├── scripts/seed.js demo data seeder
│   └── uploads/        syllabus + project files (gitignored)
```

## Installation

```bash
# from the project root
cd server && npm install
cd ../client && npm install
```

## Environment Setup

Copy `server/.env.example` to `server/.env` and fill in the values:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/evalforge
JWT_SECRET=replace_with_a_long_random_secret
GEMINI_API_KEY=
GROQ_API_KEY=
CLIENT_URL=http://localhost:5173
```

Never commit `.env`. Only `.env.example` is tracked.

## MongoDB Setup

This project uses local MongoDB (no Atlas/cloud requirement). If MongoDB Server is installed as a Windows service,
it's likely already running (`Get-Service MongoDB`). Otherwise start `mongod` pointing at a local data directory,
and make sure `MONGODB_URI` in `.env` matches (default `mongodb://127.0.0.1:27017/evalforge`).

## Gemini / Groq Setup

1. Get a Gemini API key from Google AI Studio and set `GEMINI_API_KEY` in `server/.env`.
2. (Optional) Get a Groq API key and set `GROQ_API_KEY` — it's used automatically as a fallback if Gemini fails
   or is not configured. If neither is configured, AI-dependent actions (syllabus analysis, case study/question
   generation, evaluation) return a graceful `503 AI generation temporarily unavailable. Please retry.` instead
   of crashing, and nothing already uploaded/created is lost.

## Running the App

```bash
# Terminal 1 — backend (http://localhost:5000)
cd server
npm run dev

# Terminal 2 — frontend (http://localhost:5173, proxies /api to the backend)
cd client
npm run dev
```

## Seed Data & Demo Credentials

```bash
cd server
npm run seed
```

Creates 1 admin, 1 evaluator, and 5 students (password for all: `Passw0rd!`):

| Role      | Email                        |
|-----------|-------------------------------|
| Admin     | admin@evalforge.ai            |
| Evaluator | evaluator@evalforge.ai        |
| Student   | riya.sharma@evalforge.ai      |
| Student   | arjun.mehta@evalforge.ai      |
| Student   | diya.patel@evalforge.ai       |
| Student   | kabir.singh@evalforge.ai      |
| Student   | sneha.rao@evalforge.ai        |

New students can also self-register at `/register` (student role only — Admin/Evaluator accounts are created via
the seed script or the Admin → Students/Evaluators management pages).

## API Overview

```
POST   /api/auth/register            student self-registration
POST   /api/auth/login
GET    /api/auth/me

GET    /api/subjects
POST   /api/subjects                 (admin)
DELETE /api/subjects/:id             (admin)

POST   /api/syllabus/upload          (admin) multipart file upload
GET    /api/syllabus/:id
POST   /api/syllabus/:id/analyze     (admin) triggers AI analysis
DELETE /api/syllabus/:id

POST   /api/assessments              (admin) max 3 subjects, all must have analyzed syllabi
GET    /api/assessments
GET    /api/assessments/:id
POST   /api/assessments/:id/generate (admin) runs the full generation pipeline
POST   /api/assessments/:id/publish  (admin) assigns to students with unique per-student data

GET    /api/student/assignments
GET    /api/student/assignments/:id
PATCH  /api/student/assignments/:id/autosave
POST   /api/student/assignments/:id/submit  multipart (answers JSON + project ZIP)

GET    /api/submissions
GET    /api/submissions/:id

POST   /api/evaluations/:submissionId       run AI evaluation on one submission
POST   /api/evaluations/evaluate-all        starts a background job, returns { jobId }
GET    /api/evaluations/job/:jobId          poll job progress
PATCH  /api/evaluations/:id/review          approve / modify (reason required) / reject
POST   /api/evaluations/:id/publish
GET    /api/evaluations/similarity/:assessmentId

GET    /api/results
GET    /api/results/student/:studentId
GET    /api/results/:id/report              PDF download

GET    /api/analytics/admin
GET    /api/analytics/evaluator

GET    /api/users?role=student|evaluator    (admin)
POST   /api/users                           (admin) create evaluator/student accounts
```

## Assessment Generation Flow

1. Admin creates subjects and uploads a syllabus (PDF/DOCX/TXT) for each.
2. Admin runs AI analysis on each syllabus → topics, subtopics, learning objectives, practical skills.
3. Admin creates an assessment, selecting **up to 3** analyzed subjects, a difficulty, and a duration.
4. Admin clicks **Generate with AI** → case study → dynamic rubric → question batch generation, filtered by a
   local quality score and uniqueness check (regenerating near-duplicates), with per-question data templates for
   personalization.
5. Admin clicks **Publish** → each selected student gets a `StudentAssignment` with a deterministic seed
   (`assessmentId:studentId`) resolving each question's data template into concrete, student-specific values.

## Evaluation Flow

1. Student submits answers + a project ZIP; the ZIP is statically analyzed (files, languages, dependencies,
   README/test/DB detection) — nothing is executed.
2. Evaluator opens **Submissions**, picks an assessment, and clicks **Evaluate All** (or evaluates one submission).
3. The evaluation engine sends the case study, rubric, student's answers, and project evidence to the AI, which
   returns criterion-wise marks, strengths/weaknesses/recommendations, evidence (or "Evidence unavailable"), a
   UI/UX evaluation when screenshots exist, per-question scores, and a confidence score.
4. Evaluator reviews the AI result: **Approve**, **Modify** (per-criterion, reason required), or **Reject**.
5. Evaluator **publishes** the result → the student sees their final score, grade, and detailed breakdown, and can
   download a PDF report.
