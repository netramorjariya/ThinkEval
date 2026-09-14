import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Sparkles, FileText, X, ArrowRight, Trash2, ClipboardList, Scale } from 'lucide-react'
import api, { apiErrorMessage } from '../../services/api'
import { Card, CardHeader, Button, Input, Select, Badge, Dropzone, EmptyState, SkeletonRows } from '../../components/ui'

const MAX_FILES = 3
const ACCEPTED_EXT = ['.pdf', '.docx', '.txt']
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'VERY_HARD', 'EXPERT']

const statusVariant = { draft: 'neutral', generating: 'info', generated: 'brand', failed: 'danger', published: 'success', closed: 'neutral' }

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  const kb = bytes / 1024
  return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`
}

/** Derives a readable default subject label from a filename, e.g. "OS_Syllabus_2025.docx" -> "OS Syllabus 2025". */
function subjectNameFromFile(filename) {
  const withoutExt = filename.replace(/\.[^./]+$/, '')
  return withoutExt.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Subject'
}

export default function AdminExams() {
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)

  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState('MEDIUM')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [totalQuestions, setTotalQuestions] = useState(20)
  const [marksPerQuestion, setMarksPerQuestion] = useState(5)
  // Each entry: { file, subjectName, count }
  const [files, setFiles] = useState([])
  const [generating, setGenerating] = useState(false)
  const [stage, setStage] = useState('')

  function load() {
    setLoading(true)
    api
      .get('/assessments')
      .then((res) => setExams(res.data.assessments))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function addFiles(newFiles) {
    const room = MAX_FILES - files.length
    if (room <= 0) {
      toast.error(`Maximum ${MAX_FILES} syllabus files per exam.`)
      return
    }
    const accepted = []
    for (const f of newFiles) {
      const ext = `.${f.name.split('.').pop().toLowerCase()}`
      if (!ACCEPTED_EXT.includes(ext)) {
        toast.error(`${f.name}: only PDF, DOCX, or TXT files are supported.`)
        continue
      }
      accepted.push({ file: f, subjectName: subjectNameFromFile(f.name), count: 0 })
    }
    if (accepted.length > room) {
      toast.error(`Only ${room} more file(s) can be added (max ${MAX_FILES}).`)
    }
    setFiles((prev) => [...prev, ...accepted.slice(0, room)])
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function updateFile(index, patch) {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  function distributeEvenly() {
    if (files.length === 0) return
    const total = Number(totalQuestions) || 0
    const base = Math.floor(total / files.length)
    const remainder = total % files.length
    setFiles((prev) => prev.map((f, i) => ({ ...f, count: base + (i < remainder ? 1 : 0) })))
  }

  const totalQuestionsNum = Number(totalQuestions) || 0
  const marksPerQuestionNum = Number(marksPerQuestion) || 0
  const totalMarks = totalQuestionsNum * marksPerQuestionNum
  const totalAssigned = files.reduce((sum, f) => sum + (Number(f.count) || 0), 0)
  const distributionValid = files.length > 0 && totalAssigned === totalQuestionsNum

  async function handleGenerate() {
    if (!title.trim()) return toast.error('Give this exam a title.')
    if (files.length === 0) return toast.error('Upload at least 1 syllabus file (max 3).')
    if (!Number.isInteger(totalQuestionsNum) || totalQuestionsNum < 1 || totalQuestionsNum > 100) {
      return toast.error('Total number of MCQs must be a whole number between 1 and 100.')
    }
    if (!(marksPerQuestionNum > 0)) return toast.error('Marks per MCQ must be greater than 0.')
    if (!distributionValid) return toast.error('Question distribution must exactly match the total number of MCQs.')

    setGenerating(true)
    let createdAssessmentId = null
    try {
      // 1. Upload + analyze each syllabus file, creating a subject named by the admin for it.
      const subjectIds = []
      const distribution = []
      for (let i = 0; i < files.length; i += 1) {
        setStage(`Uploading syllabus ${i + 1} of ${files.length}...`)
        const subjectRes = await api.post('/subjects', {
          name: files[i].subjectName.trim() || `Subject ${i + 1}`,
          description: 'Created for exam generation.',
        })
        const subjectId = subjectRes.data.subject._id

        const formData = new FormData()
        formData.append('subjectId', subjectId)
        formData.append('file', files[i].file)
        const syllabusRes = await api.post('/syllabus/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

        setStage(`Analyzing syllabus ${i + 1} of ${files.length}...`)
        await api.post(`/syllabus/${syllabusRes.data.syllabus._id}/analyze`)

        subjectIds.push(subjectId)
        distribution.push({ subject: subjectId, count: Number(files[i].count) })
      }

      // 2. Create the exam record.
      setStage('Creating exam...')
      const examRes = await api.post('/assessments', {
        title: title.trim(),
        subjectIds,
        difficulty,
        durationMinutes: Number(durationMinutes) || 60,
        totalQuestions: totalQuestionsNum,
        marksPerQuestion: marksPerQuestionNum,
        questionDistribution: distribution,
      })
      createdAssessmentId = examRes.data.assessment._id

      // 3. Generate MCQs with Gemini, respecting the per-subject distribution.
      setStage(`Generating ${totalQuestionsNum} MCQs with Gemini...`)
      await api.post(`/assessments/${createdAssessmentId}/generate`)

      toast.success(`${totalQuestionsNum} MCQs generated. Review them before publishing.`)
      setTitle('')
      setFiles([])
      navigate(`/admin/assessments/${createdAssessmentId}`)
    } catch (err) {
      toast.error(apiErrorMessage(err))
      if (createdAssessmentId) {
        // The exam record exists (possibly in a 'failed' state) — send the admin to review/retry
        // rather than leaving them stuck on this form.
        navigate(`/admin/assessments/${createdAssessmentId}`)
      }
    } finally {
      setGenerating(false)
      setStage('')
    }
  }

  async function handleDeleteExam(id, e) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this exam?')) return
    try {
      await api.delete(`/assessments/${id}`)
      toast.success('Exam deleted.')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Exams &middot; MCQ Generator</h1>
        <p className="text-sm text-ink-500">
          Upload up to 3 syllabi, choose how many MCQs come from each, and generate with Gemini — all in one step.
        </p>
      </div>

      <Card>
        <CardHeader title="1. Exam Details" subtitle="Basic information for the new exam." />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <Input
            label="Exam Title"
            className="sm:col-span-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Data Structures — Midterm"
            disabled={generating}
          />
          <Select label="Exam Level / Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} disabled={generating}>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Input
            label="Duration (minutes)"
            type="number"
            min={15}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            disabled={generating}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="2. Syllabus" subtitle="Upload up to 3 files — analysis runs automatically as part of generation, no separate 'Analyze' step." />
        <div className="p-5">
          <span className="mb-1.5 block text-xs font-medium text-ink-700">Syllabus files ({files.length}/{MAX_FILES})</span>
          {files.length < MAX_FILES && (
            <Dropzone
              icon={FileText}
              accept=".pdf,.docx,.txt"
              multiple
              disabled={generating}
              hint="PDF, DOCX, or TXT · up to 3 files"
              onFiles={addFiles}
            />
          )}
          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((f, i) => (
                <div key={`${f.file.name}-${i}`} className="flex flex-col gap-2 rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2 sm:flex-row sm:items-center">
                  <FileText className="hidden h-4 w-4 shrink-0 text-ink-400 sm:block" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink-800">{f.file.name}</p>
                    <p className="text-[11px] text-ink-400">{formatBytes(f.file.size)}</p>
                  </div>
                  <input
                    type="text"
                    value={f.subjectName}
                    onChange={(e) => updateFile(i, { subjectName: e.target.value })}
                    disabled={generating}
                    placeholder="Subject name"
                    className="w-full rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:w-40"
                  />
                  <Badge variant="neutral">Pending</Badge>
                  {!generating && (
                    <button onClick={() => removeFile(i)} className="rounded-md p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="3. Question Configuration" subtitle="How many MCQs, how many marks each, and how they split across subjects." />
        <div className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Total Number of MCQs"
              type="number"
              min={1}
              max={100}
              value={totalQuestions}
              onChange={(e) => setTotalQuestions(e.target.value)}
              disabled={generating}
            />
            <Input
              label="Marks Per MCQ"
              type="number"
              min={0.01}
              step="0.5"
              value={marksPerQuestion}
              onChange={(e) => setMarksPerQuestion(e.target.value)}
              disabled={generating}
            />
            <div className="flex flex-col justify-end">
              <span className="mb-1 block text-xs font-medium text-ink-700">Total Marks</span>
              <div className="flex h-11 items-center gap-2 rounded-xl bg-brand-50 px-3.5 text-sm font-semibold text-brand-800">
                <Scale className="h-4 w-4 text-brand-500" /> {totalMarks || 0}
              </div>
            </div>
          </div>

          {files.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-ink-700">Questions Per Subject</span>
                <Button variant="secondary" onClick={distributeEvenly} disabled={generating} className="px-2.5! py-1! text-xs">
                  Distribute Evenly
                </Button>
              </div>
              <div className="space-y-2 rounded-lg border border-ink-200 p-3">
                {files.map((f, i) => (
                  <div key={`${f.file.name}-dist-${i}`} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-ink-700">{f.subjectName || `Subject ${i + 1}`}</span>
                    <input
                      type="number"
                      min={0}
                      value={f.count}
                      onChange={(e) => updateFile(i, { count: e.target.value === '' ? '' : Number(e.target.value) })}
                      disabled={generating}
                      className="w-20 rounded-lg border border-ink-200 px-2 py-1 text-right text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                ))}
                <div
                  className={`mt-2 rounded-lg px-3 py-2 text-xs font-medium ${
                    distributionValid
                      ? 'bg-emerald-50 text-emerald-700'
                      : totalAssigned < totalQuestionsNum
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {distributionValid
                    ? `✓ Question distribution is valid (${totalAssigned} / ${totalQuestionsNum})`
                    : totalAssigned < totalQuestionsNum
                    ? `⚠ ${totalAssigned} of ${totalQuestionsNum} questions assigned`
                    : `⚠ Distribution exceeds the total by ${totalAssigned - totalQuestionsNum} question${totalAssigned - totalQuestionsNum === 1 ? '' : 's'}`}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="4. Generation" subtitle="Gemini generates every MCQ from your syllabi, respecting the subject split above." />
        <div className="space-y-4 p-5">
          {generating && (
            <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" /> {stage}
            </div>
          )}
          <Button icon={Sparkles} loading={generating} disabled={!distributionValid} onClick={handleGenerate} className="w-full sm:w-auto">
            Generate MCQs
          </Button>
        </div>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink-900">Your Exams</h2>
        {loading ? (
          <SkeletonRows rows={3} />
        ) : exams.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No exams yet" description="Create your first exam above." />
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {exams.map((a) => (
              <Link to={`/admin/assessments/${a._id}`} key={a._id}>
                <Card className="flex flex-col gap-3 p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink-900">{a.title}</h3>
                      <Badge variant={statusVariant[a.status]}>{a.status}</Badge>
                      <Badge variant="neutral">{a.difficulty}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {a.totalQuestions ?? 20} MCQs &middot; {a.totalMarks ?? 100} marks &middot; {a.durationMinutes} min
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.status !== 'published' && (
                      <button onClick={(e) => handleDeleteExam(a._id, e)} className="rounded-lg p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink-400" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
