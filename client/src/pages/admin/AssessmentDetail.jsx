import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Sparkles, Send, Trash2, ArrowLeft, Users, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react'
import api, { apiErrorMessage } from '../../services/api'
import { Card, CardHeader, Button, Badge, Modal, SkeletonRows, StatCard } from '../../components/ui'

const statusVariant = { draft: 'neutral', generating: 'info', generated: 'brand', failed: 'danger', published: 'success', closed: 'neutral' }

export default function AdminAssessmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [assessment, setAssessment] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [students, setStudents] = useState([])
  const [selectedStudents, setSelectedStudents] = useState([])

  function load() {
    setLoading(true)
    api
      .get(`/assessments/${id}`)
      .then((res) => {
        setAssessment(res.data.assessment)
        setQuestions(res.data.questions)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await api.post(`/assessments/${id}/generate`)
      toast.success(`${res.data.assessment.totalQuestions} MCQs generated successfully. Review them below before publishing.`)
      setAssessment(res.data.assessment)
      setQuestions(res.data.questions)
    } catch (err) {
      toast.error(apiErrorMessage(err))
      load()
    } finally {
      setGenerating(false)
    }
  }

  async function openPublish() {
    const res = await api.get('/users?role=student')
    setStudents(res.data.users)
    setSelectedStudents(res.data.users.map((u) => u._id))
    setPublishOpen(true)
  }

  async function handlePublish() {
    setPublishing(true)
    try {
      const res = await api.post(`/assessments/${id}/publish`, { studentIds: selectedStudents })
      toast.success(`Assessment published to ${res.data.assignedCount} student(s).`)
      setPublishOpen(false)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setPublishing(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this assessment?')) return
    try {
      await api.delete(`/assessments/${id}`)
      toast.success('Assessment deleted.')
      navigate('/admin/assessments')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  if (loading) return <SkeletonRows rows={6} />
  if (!assessment) return null

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/admin/assessments')} className="flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to assessments
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-ink-900">{assessment.title}</h1>
            <Badge variant={statusVariant[assessment.status]}>{assessment.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {assessment.subjects.map((s) => s.name).join(' + ')} · {assessment.difficulty} · {assessment.durationMinutes} min
          </p>
        </div>
        <div className="flex gap-2">
          {assessment.status !== 'published' && (
            <Button variant="danger" icon={Trash2} onClick={handleDelete}>Delete</Button>
          )}
          {(assessment.status === 'draft' || assessment.status === 'failed') && (
            <Button icon={Sparkles} loading={generating} onClick={handleGenerate}>Generate Questions</Button>
          )}
          {assessment.status === 'generated' && (
            <>
              <Button variant="secondary" icon={Sparkles} loading={generating} onClick={handleGenerate}>Regenerate</Button>
              <Button icon={Send} onClick={openPublish}>Publish to Students</Button>
            </>
          )}
        </div>
      </div>

      {assessment.status === 'failed' && (
        <Card className="flex items-center gap-3 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {assessment.generationError || 'AI generation temporarily unavailable. Please retry.'}
        </Card>
      )}

      {assessment.status === 'generating' && (
        <Card className="flex items-center gap-3 border-brand-200 bg-brand-50 p-4 text-sm text-brand-700">
          <Sparkles className="h-4 w-4 animate-pulse shrink-0" /> Generating {assessment.totalQuestions || 20} MCQs with Gemini... this can take up to a minute.
        </Card>
      )}

      {questions.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Questions" value={`${questions.length} / ${assessment.totalQuestions ?? questions.length}`} icon={ShieldCheck} tone="brand" />
          <StatCard
            label="Total Marks"
            value={assessment.totalMarks ?? questions.length * 5}
            hint={`${assessment.marksPerQuestion ?? 5} marks per question`}
            icon={CheckCircle2}
            tone="emerald"
          />
          <StatCard label="Negative Marking" value="None" icon={AlertTriangle} tone="sky" />
        </div>
      )}

      {questions.length > 0 && assessment.questionDistribution?.length > 0 && (
        <Card>
          <CardHeader title="Generated Questions" subtitle="Requested vs. actual questions per subject" />
          <div className="space-y-2 p-5">
            <div className="flex items-center justify-between text-sm font-semibold text-ink-900">
              <span>Total</span>
              <span>{questions.length} / {assessment.totalQuestions}</span>
            </div>
            {assessment.questionDistribution.map((d) => {
              const subjectId = String(d.subject?._id || d.subject)
              const subj = assessment.subjects.find((s) => String(s._id) === subjectId)
              const actual = questions.filter((q) => String(q.subject?._id || q.subject) === subjectId).length
              const ok = actual === d.count
              return (
                <div key={subjectId} className="flex items-center justify-between text-sm">
                  <span className="text-ink-600">{subj?.name || 'Subject'}</span>
                  <span className={ok ? 'font-medium text-emerald-600' : 'font-medium text-amber-600'}>
                    {actual} / {d.count} {ok ? '✓' : ''}
                  </span>
                </div>
              )
            })}
            <div className="flex items-center justify-between border-t border-ink-100 pt-2 text-sm font-semibold text-ink-900">
              <span>Total Marks</span>
              <span>{assessment.totalMarks}</span>
            </div>
          </div>
        </Card>
      )}

      {questions.length > 0 && (
        <Card>
          <CardHeader
            title="5. Generated Questions"
            subtitle={`${questions.length} questions · review the correct answer and explanation below before publishing`}
          />
          <div className="divide-y divide-ink-100">
            {questions.map((q) => (
              <div key={q._id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="brand">Q{q.order}</Badge>
                  <Badge variant="neutral">{q.difficulty}</Badge>
                  <Badge variant="success">{q.maxMarks} marks</Badge>
                  {q.subject?.name && <Badge variant="info">{q.subject.name}</Badge>}
                  <span className="ml-auto flex items-center gap-1 text-xs text-ink-500">
                    <ShieldCheck className="h-3.5 w-3.5" /> Quality {q.qualityScore}/100
                  </span>
                </div>
                <p className="text-sm font-medium text-ink-900">{q.questionText}</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {(q.options || []).map((opt) => (
                    <div
                      key={opt.key}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
                        opt.key === q.correctAnswer
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          : 'border-ink-200 text-ink-600'
                      }`}
                    >
                      <span className="font-semibold">{opt.key}.</span> {opt.text}
                      {opt.key === q.correctAnswer && <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                    </div>
                  ))}
                </div>
                {q.explanation && (
                  <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
                    <span className="font-semibold text-ink-700">Explanation: </span>{q.explanation}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {q.topics.map((t, i) => <Badge key={i} variant="neutral">{t}</Badge>)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Publish Assessment"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPublishOpen(false)}>Cancel</Button>
            <Button icon={Send} loading={publishing} onClick={handlePublish}>
              Publish to {selectedStudents.length} student(s)
            </Button>
          </>
        }
      >
        <p className="mb-3 text-xs text-ink-500 flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> Every selected student receives the same {assessment.totalQuestions} MCQs, worth {assessment.totalMarks} marks total.
        </p>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {students.map((s) => (
            <label key={s._id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink-50">
              <input
                type="checkbox"
                checked={selectedStudents.includes(s._id)}
                onChange={(e) =>
                  setSelectedStudents((prev) => (e.target.checked ? [...prev, s._id] : prev.filter((x) => x !== s._id)))
                }
                className="rounded border-ink-300"
              />
              <span>{s.name}</span>
              <span className="text-xs text-ink-400">{s.studentId}</span>
            </label>
          ))}
        </div>
      </Modal>
    </div>
  )
}
