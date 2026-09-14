import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Clock, Flag, ChevronLeft, ChevronRight, Send, Save, CheckCircle2 } from 'lucide-react'
import api, { apiErrorMessage } from '../../services/api'
import { Card, Button, Badge, Spinner } from '../../components/ui'

const AUTOSAVE_INTERVAL_MS = 15000
const OPTION_KEYS = ['A', 'B', 'C', 'D']

export default function AssessmentTake() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [assignment, setAssignment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState({})
  const [reviewFlags, setReviewFlags] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [remainingSeconds, setRemainingSeconds] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    api
      .get(`/student/assignments/${id}`)
      .then((res) => {
        const a = res.data.assignment
        setAssignment(a)
        const initialSelections = {}
        const initialFlags = {}
        for (const ans of a.autosave?.answers || []) {
          initialSelections[ans.question] = ans.selectedOption || ''
          initialFlags[ans.question] = ans.markedForReview
        }
        setSelections(initialSelections)
        setReviewFlags(initialFlags)

        const durationSeconds = a.assessment.durationMinutes * 60
        const startedAt = a.startedAt ? new Date(a.startedAt).getTime() : Date.now()
        const elapsed = Math.floor((Date.now() - startedAt) / 1000)
        setRemainingSeconds(Math.max(0, durationSeconds - elapsed))
      })
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [id])

  const questions = assignment?.resolvedQuestions || []
  const current = questions[currentIndex]
  const totalMarks = questions.reduce((sum, q) => sum + (q.maxMarks || 0), 0)

  const persistAutosave = useCallback(
    async (silent = true) => {
      if (!assignment || submittedRef.current) return
      const payload = questions.map((q) => ({
        question: q.question,
        selectedOption: selections[q.question] || '',
        markedForReview: !!reviewFlags[q.question],
      }))
      try {
        if (!silent) setSaving(true)
        await api.patch(`/student/assignments/${id}/autosave`, { answers: payload, timeRemainingSeconds: remainingSeconds })
        setLastSaved(new Date())
      } catch {
        // silent autosave failures are non-fatal; next interval retries
      } finally {
        if (!silent) setSaving(false)
      }
    },
    [assignment, questions, selections, reviewFlags, remainingSeconds, id],
  )

  useEffect(() => {
    if (!assignment) return
    const interval = setInterval(() => persistAutosave(true), AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [assignment, persistAutosave])

  const handleSubmit = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return
      submittedRef.current = true
      setSubmitting(true)
      try {
        const answers = questions.map((q) => ({ question: q.question, selectedOption: selections[q.question] || '' }))
        await api.post(`/student/assignments/${id}/submit`, { answers })
        toast.success(auto ? 'Time is up — your assessment was auto-submitted.' : 'Assessment submitted! Your result is ready.')
        navigate('/student/results')
      } catch (err) {
        submittedRef.current = false
        toast.error(apiErrorMessage(err))
      } finally {
        setSubmitting(false)
      }
    },
    [questions, selections, id, navigate],
  )

  useEffect(() => {
    if (remainingSeconds === null || submittedRef.current) return
    if (remainingSeconds <= 0) {
      handleSubmit(true)
      return
    }
    const timer = setTimeout(() => setRemainingSeconds((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [remainingSeconds, handleSubmit])

  const timeDisplay = useMemo(() => {
    if (remainingSeconds === null) return '--:--'
    const h = Math.floor(remainingSeconds / 3600)
    const m = Math.floor((remainingSeconds % 3600) / 60)
    const s = remainingSeconds % 60
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
  }, [remainingSeconds])

  const answeredCount = questions.filter((q) => !!selections[q.question]).length

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Spinner className="h-8 w-8 text-brand-600" /></div>
  }
  if (!assignment) return null

  const isLowTime = remainingSeconds !== null && remainingSeconds < 300

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-ink-900">{assignment.assessment.title}</h1>
            <Badge variant="neutral">{assignment.assessment.difficulty}</Badge>
          </div>
          <p className="text-xs text-ink-500">
            {questions.length} Questions &middot; {totalMarks} Marks &middot; {assignment.assessment.durationMinutes} Minutes &middot; {answeredCount} answered so far &middot; no negative marking
          </p>
        </div>
        <div className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold ${isLowTime ? 'bg-rose-50 text-rose-600' : 'bg-brand-50 text-brand-700'}`}>
          <Clock className="h-4 w-4" /> {timeDisplay}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="order-2 p-4 lg:order-1 lg:col-span-1">
          <p className="mb-3 text-xs font-semibold uppercase text-ink-400">Questions</p>
          <div className="grid grid-cols-6 gap-2 lg:grid-cols-4">
            {questions.map((q, i) => {
              const answered = !!selections[q.question]
              const flagged = reviewFlags[q.question]
              return (
                <button
                  key={q.question}
                  onClick={() => setCurrentIndex(i)}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                    i === currentIndex
                      ? 'bg-brand-600 text-white'
                      : answered
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-ink-100 text-ink-500'
                  }`}
                >
                  {q.order}
                  {flagged && <Flag className="absolute -right-1 -top-1 h-3 w-3 fill-amber-400 text-amber-500" />}
                </button>
              )
            })}
          </div>
          <div className="mt-4 space-y-1.5 text-xs text-ink-500">
            <p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Answered</p>
            <p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ink-300" /> Not answered</p>
            <p className="flex items-center gap-1.5"><Flag className="h-3 w-3 fill-amber-400 text-amber-500" /> Marked for review</p>
          </div>

          <Button
            variant="danger"
            className="mt-5 w-full"
            icon={Send}
            loading={submitting}
            onClick={() => {
              if (confirm('Submit your final answers? This cannot be undone.')) handleSubmit(false)
            }}
          >
            Submit Assessment
          </Button>
        </Card>

        <div className="order-1 lg:order-2 lg:col-span-3">
          {current && (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="brand">Question {current.order}</Badge>
                  <Badge variant="success">{current.maxMarks} marks</Badge>
                </div>
                <button
                  onClick={() => setReviewFlags((f) => ({ ...f, [current.question]: !f[current.question] }))}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                    reviewFlags[current.question] ? 'bg-amber-100 text-amber-700' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                  }`}
                >
                  <Flag className="h-3.5 w-3.5" /> {reviewFlags[current.question] ? 'Marked for review' : 'Mark for review'}
                </button>
              </div>

              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-800">{current.questionText}</p>

              <div className="mt-4 space-y-2">
                {OPTION_KEYS.map((key) => {
                  const opt = (current.options || []).find((o) => o.key === key)
                  if (!opt) return null
                  const selected = selections[current.question] === key
                  return (
                    <label
                      key={key}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                        selected ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-ink-200 text-ink-700 hover:bg-ink-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${current.question}`}
                        checked={selected}
                        onChange={() => setSelections((s) => ({ ...s, [current.question]: key }))}
                        className="h-4 w-4 shrink-0 accent-brand-600"
                      />
                      <span className="font-semibold">{key}.</span>
                      <span>{opt.text}</span>
                      {selected && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-brand-600" />}
                    </label>
                  )
                })}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <Button variant="secondary" icon={ChevronLeft} disabled={currentIndex === 0} onClick={() => setCurrentIndex((i) => i - 1)}>
                  Previous
                </Button>
                <div className="flex items-center gap-3">
                  <button onClick={() => persistAutosave(false)} className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-800">
                    {saving ? <Spinner className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                    {saving ? 'Saving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Save draft'}
                  </button>
                </div>
                <Button
                  variant="secondary"
                  icon={ChevronRight}
                  disabled={currentIndex === questions.length - 1}
                  onClick={() => setCurrentIndex((i) => i + 1)}
                  className="flex-row-reverse"
                >
                  Next
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
