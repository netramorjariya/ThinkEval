import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Zap, Eye, ShieldAlert } from 'lucide-react'
import api, { apiErrorMessage } from '../../services/api'
import { Card, CardHeader, Select, Button, Badge, EmptyState, SkeletonRows, ProgressBar } from '../../components/ui'

const evalStatusVariant = {
  not_evaluated: 'neutral',
  pending: 'neutral',
  evaluating: 'info',
  ai_evaluated: 'brand',
  failed: 'danger',
  reviewed: 'success',
  published: 'success',
}

export default function EvaluatorSubmissions() {
  const [assessments, setAssessments] = useState([])
  const [assessmentId, setAssessmentId] = useState('')
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [job, setJob] = useState(null)
  const [similarity, setSimilarity] = useState([])
  const pollRef = useRef(null)

  useEffect(() => {
    api.get('/assessments').then((res) => {
      const published = res.data.assessments.filter((a) => a.status === 'published')
      setAssessments(published)
      if (published[0]) setAssessmentId(published[0]._id)
    })
  }, [])

  function loadSubmissions(aid) {
    if (!aid) return
    setLoading(true)
    api
      .get(`/submissions?assessmentId=${aid}`)
      .then((res) => setSubmissions(res.data.submissions))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadSubmissions(assessmentId)
    setSimilarity([])
  }, [assessmentId])

  useEffect(() => () => clearInterval(pollRef.current), [])

  async function handleEvaluateAll() {
    try {
      const res = await api.post('/evaluations/evaluate-all', { assessmentId })
      if (!res.data.jobId) {
        toast('No eligible submissions to evaluate.')
        return
      }
      setJob({ completed: 0, total: res.data.total, status: 'running' })
      pollRef.current = setInterval(async () => {
        const jobRes = await api.get(`/evaluations/job/${res.data.jobId}`)
        setJob(jobRes.data.job)
        if (jobRes.data.job.status === 'completed') {
          clearInterval(pollRef.current)
          const failedCount = jobRes.data.job.failed
          toast.success(`Evaluated ${jobRes.data.job.completed - failedCount}/${jobRes.data.job.total} submissions${failedCount ? ` (${failedCount} failed)` : ''}.`)
          loadSubmissions(assessmentId)
        }
      }, 1500)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  async function checkSimilarity() {
    try {
      const res = await api.get(`/evaluations/similarity/${assessmentId}`)
      setSimilarity(res.data.flags)
      if (res.data.flags.length === 0) toast.success('No high-similarity submission pairs found.')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Submissions</h1>
          <p className="text-sm text-ink-500">Review and AI-evaluate student submissions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} className="min-w-[220px]">
            {assessments.map((a) => <option key={a._id} value={a._id}>{a.title}</option>)}
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Evaluate All"
          subtitle="Runs the AI evaluation engine on every submitted, not-yet-evaluated student."
          action={
            <div className="flex gap-2">
              <Button variant="secondary" icon={ShieldAlert} onClick={checkSimilarity}>Check Similarity</Button>
              <Button icon={Zap} onClick={handleEvaluateAll} disabled={job?.status === 'running'}>Evaluate All</Button>
            </div>
          }
        />
        {job && (
          <div className="p-5">
            <div className="mb-2 flex items-center justify-between text-xs text-ink-500">
              <span>Evaluating {job.completed} / {job.total}</span>
              <span>{job.status === 'completed' ? 'Done' : 'Running...'}</span>
            </div>
            <ProgressBar value={job.completed} max={job.total} tone={job.status === 'completed' ? 'emerald' : 'brand'} />
          </div>
        )}
        {similarity.length > 0 && (
          <div className="border-t border-ink-100 p-5">
            <p className="mb-2 text-xs font-semibold uppercase text-amber-600">High Similarity — Review Recommended</p>
            <div className="space-y-1.5 text-xs text-ink-600">
              {similarity.map((f, i) => (
                <p key={i}>
                  {f.studentA.name} vs {f.studentB.name} — Answers {f.answerSimilarityPct}%, Code {f.codeSimilarityPct}%, Docs {f.docSimilarityPct}%
                </p>
              ))}
            </div>
          </div>
        )}
      </Card>

      {loading ? (
        <SkeletonRows rows={4} />
      ) : submissions.length === 0 ? (
        <EmptyState title="No submissions yet" description="Submissions will appear here once students submit their assessments." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-xs uppercase text-ink-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Evaluation Status</th>
                <th className="px-4 py-3">AI Score</th>
                <th className="px-4 py-3">Final Score</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {submissions.map((s) => (
                <tr key={s._id}>
                  <td className="px-4 py-3 font-medium text-ink-800">{s.student.name} <span className="text-xs text-ink-400">({s.student.studentId})</span></td>
                  <td className="px-4 py-3 text-ink-500">{new Date(s.submittedAt).toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge variant={evalStatusVariant[s.evaluationStatus]}>{s.evaluationStatus.replace('_', ' ')}</Badge></td>
                  <td className="px-4 py-3 text-ink-700">{s.aiScore ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold text-ink-900">{s.finalScore ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/evaluator/evaluate/${s._id}`}>
                      <Button variant="secondary" icon={Eye}>Review</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
