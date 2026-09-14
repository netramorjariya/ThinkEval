import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Sparkles, ThumbsUp, ThumbsDown, Lightbulb, ShieldCheck, AlertTriangle, FileCode2,
  CheckCircle2, XCircle, Edit3, Send, ArrowLeft, Gauge,
} from 'lucide-react'
import api, { apiErrorMessage } from '../../services/api'
import { Card, CardHeader, Button, Badge, Textarea, ProgressBar, Spinner } from '../../components/ui'

export default function EvaluatorEvaluate() {
  const { submissionId } = useParams()
  const navigate = useNavigate()
  const [submission, setSubmission] = useState(null)
  const [evaluation, setEvaluation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [runningAi, setRunningAi] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [modifiedCriteria, setModifiedCriteria] = useState([])
  const [comment, setComment] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)

  function load() {
    setLoading(true)
    api
      .get(`/submissions/${submissionId}`)
      .then((res) => {
        setSubmission(res.data.submission)
        setEvaluation(res.data.evaluation)
        if (res.data.evaluation?.ai?.criteria) {
          setModifiedCriteria(res.data.evaluation.ai.criteria.map((c) => ({ ...c })))
        }
        if (res.data.evaluation?.review?.comment) setComment(res.data.evaluation.review.comment)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [submissionId])

  async function runAiEvaluation() {
    setRunningAi(true)
    try {
      const res = await api.post(`/evaluations/${submissionId}`)
      setEvaluation(res.data.evaluation)
      setModifiedCriteria(res.data.evaluation.ai.criteria.map((c) => ({ ...c })))
      toast.success('AI evaluation complete.')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setRunningAi(false)
    }
  }

  async function submitReview(action) {
    if ((action === 'modify' || action === 'reject') && !reason.trim()) {
      toast.error('A reason is required when changing or rejecting AI marks.')
      return
    }
    setSaving(true)
    try {
      const res = await api.patch(`/evaluations/${evaluation._id}/review`, {
        action,
        modifiedCriteria: action === 'modify' ? modifiedCriteria : undefined,
        comment,
        reason,
      })
      setEvaluation(res.data.evaluation)
      setReviewMode(false)
      toast.success(`Evaluation ${action === 'approve' ? 'approved' : action === 'modify' ? 'updated' : 'rejected'}.`)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    setPublishing(true)
    try {
      await api.post(`/evaluations/${evaluation._id}/publish`)
      toast.success('Result published to student.')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setPublishing(false)
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner className="h-8 w-8 text-brand-600" /></div>
  if (!submission) return null

  const ai = evaluation?.ai
  const finalScore = evaluation?.review?.finalScore
  const modifiedSum = modifiedCriteria.reduce((s, c) => s + (Number(c.scoreAwarded) || 0), 0)

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to submissions
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">{submission.student.name}</h1>
          <p className="text-sm text-ink-500">{submission.student.studentId} · {submission.assessment.title}</p>
        </div>
        {evaluation?.status && <Badge variant={evaluation.status === 'published' ? 'success' : 'brand'}>{evaluation.status.replace('_', ' ')}</Badge>}
      </div>

      {!ai && (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <Sparkles className="h-8 w-8 text-brand-500" />
          <p className="text-sm text-ink-600">This submission has not been AI-evaluated yet.</p>
          <Button icon={Sparkles} loading={runningAi} onClick={runAiEvaluation}>Run AI Evaluation</Button>
        </Card>
      )}

      {ai && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="p-5 text-center">
              <p className="text-xs font-medium uppercase text-ink-400">AI Score</p>
              <p className="mt-1 text-3xl font-bold text-ink-900">{ai.overallScore}</p>
              <p className="text-xs text-ink-400">out of 100</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-xs font-medium uppercase text-ink-400">Final Score</p>
              <p className="mt-1 text-3xl font-bold text-brand-600">{finalScore ?? '—'}</p>
              <p className="text-xs text-ink-400">{evaluation.review.status === 'modified' ? 'Evaluator modified' : evaluation.review.status === 'approved' ? 'Evaluator approved' : 'Pending review'}</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="flex items-center justify-center gap-1 text-xs font-medium uppercase text-ink-400"><Gauge className="h-3.5 w-3.5" /> AI Confidence</p>
              <p className="mt-1 text-3xl font-bold text-ink-900">{ai.confidenceScore}%</p>
              {ai.manualReviewRecommended && <Badge variant="warning" className="mt-1">Manual Review Recommended</Badge>}
            </Card>
          </div>

          {ai.manualReviewRecommended && ai.manualReviewReasons?.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 p-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700"><AlertTriangle className="h-4 w-4" /> Why manual review is recommended</p>
              <ul className="list-inside list-disc space-y-1 text-xs text-amber-700">
                {ai.manualReviewReasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Criterion-wise Marks"
              action={
                !reviewMode && evaluation.status !== 'published' ? (
                  <Button variant="secondary" icon={Edit3} onClick={() => setReviewMode(true)}>Review & Override</Button>
                ) : null
              }
            />
            <div className="divide-y divide-ink-100">
              {(reviewMode ? modifiedCriteria : ai.criteria).map((c, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-ink-800">{c.name}</p>
                    {reviewMode ? (
                      <input
                        type="number"
                        min={0}
                        max={c.maxMarks}
                        value={c.scoreAwarded}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          setModifiedCriteria((prev) => prev.map((mc, mi) => (mi === i ? { ...mc, scoreAwarded: val } : mc)))
                        }}
                        className="w-20 rounded-lg border border-ink-200 px-2 py-1 text-right text-sm"
                      />
                    ) : (
                      <span className="text-sm font-semibold text-ink-900">{c.scoreAwarded}/{c.maxMarks}</span>
                    )}
                  </div>
                  <div className="mt-1.5"><ProgressBar value={c.scoreAwarded} max={c.maxMarks} /></div>
                  <p className="mt-1.5 text-xs text-ink-500">{c.reasoning}</p>
                </div>
              ))}
            </div>
            {reviewMode && (
              <div className="space-y-3 border-t border-ink-100 p-5">
                <p className="text-sm font-semibold text-ink-800">Modified total: {modifiedSum} / 100</p>
                <Textarea label="Comment (visible to student)" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
                <Textarea label="Reason for change (required when modifying/rejecting)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The student used a valid alternative architecture not recognized by the AI." />
                <div className="flex flex-wrap gap-2">
                  <Button icon={CheckCircle2} loading={saving} onClick={() => submitReview('approve')}>Approve AI Score</Button>
                  <Button variant="secondary" icon={Edit3} loading={saving} onClick={() => submitReview('modify')}>Save Modified Marks</Button>
                  <Button variant="danger" icon={XCircle} loading={saving} onClick={() => submitReview('reject')}>Reject / Request Re-evaluation</Button>
                  <Button variant="ghost" onClick={() => setReviewMode(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-emerald-600"><ThumbsUp className="h-3.5 w-3.5" /> Strengths</p>
              <ul className="list-inside list-disc space-y-1 text-xs text-ink-600">{ai.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </Card>
            <Card className="p-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-rose-600"><ThumbsDown className="h-3.5 w-3.5" /> Weaknesses</p>
              <ul className="list-inside list-disc space-y-1 text-xs text-ink-600">{ai.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </Card>
            <Card className="p-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-brand-600"><Lightbulb className="h-3.5 w-3.5" /> Recommendations</p>
              <ul className="list-inside list-disc space-y-1 text-xs text-ink-600">{ai.recommendations.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </Card>
            <Card className="p-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-ink-500"><ShieldCheck className="h-3.5 w-3.5" /> Missing Requirements</p>
              <ul className="list-inside list-disc space-y-1 text-xs text-ink-600">{ai.missingRequirements.length ? ai.missingRequirements.map((s, i) => <li key={i}>{s}</li>) : <li>None identified.</li>}</ul>
            </Card>
          </div>

          <Card className="p-5">
            <p className="mb-2 text-xs font-semibold uppercase text-ink-500">Evidence</p>
            <div className="space-y-2">
              {ai.evidence.map((e, i) => (
                <div key={i} className="rounded-lg border border-ink-100 p-3 text-xs">
                  <p className="font-medium text-ink-800">{e.claim}</p>
                  <p className={`mt-1 ${e.verified ? 'text-emerald-600' : 'text-ink-400'}`}>{e.verified ? 'Verified' : 'Unverified'} — {e.source || 'Evidence unavailable'}</p>
                </div>
              ))}
              {ai.evidence.length === 0 && <p className="text-xs text-ink-400">No specific evidence recorded.</p>}
            </div>
          </Card>

          {submission.projectAnalysis?.status === 'analyzed' && (
            <Card className="p-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-ink-500"><FileCode2 className="h-3.5 w-3.5" /> Project Analysis</p>
              <div className="grid grid-cols-2 gap-3 text-xs text-ink-600 sm:grid-cols-4">
                <p>Files: {submission.projectAnalysis.totalFileCount}</p>
                <p>Source files: {submission.projectAnalysis.sourceFileCount}</p>
                <p>README: {submission.projectAnalysis.hasReadme ? 'Yes' : 'No'}</p>
                <p>Tests: {submission.projectAnalysis.hasTests ? 'Yes' : 'No'}</p>
              </div>
              <p className="mt-2 text-xs text-ink-500">Languages: {submission.projectAnalysis.languages?.join(', ') || 'None detected'}</p>
              {ai.uiEvaluation?.applicable && (
                <div className="mt-3 rounded-lg bg-ink-50 p-3">
                  <p className="text-xs font-semibold text-ink-700">UI/UX Score: {ai.uiEvaluation.score}/10</p>
                  <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <ul className="list-inside list-disc text-xs text-emerald-600">{ai.uiEvaluation.pros?.map((p, i) => <li key={i}>{p}</li>)}</ul>
                    <ul className="list-inside list-disc text-xs text-rose-600">{ai.uiEvaluation.cons?.map((c, i) => <li key={i}>{c}</li>)}</ul>
                  </div>
                </div>
              )}
            </Card>
          )}

          {evaluation.status === 'reviewed' && evaluation.review.status !== 'rejected' && (
            <Card className="flex items-center justify-between p-5">
              <p className="text-sm text-ink-600">Ready to publish this result to the student?</p>
              <Button icon={Send} loading={publishing} onClick={handlePublish}>Publish Result</Button>
            </Card>
          )}
          {evaluation.status === 'published' && (
            <Card className="flex items-center gap-2 border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> This result has been published to the student.
            </Card>
          )}
        </>
      )}
    </div>
  )
}
