import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Award, Download, CheckCircle2, XCircle, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import api, { apiErrorMessage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Card, CardHeader, Badge, EmptyState, SkeletonRows, Button, ProgressBar } from '../../components/ui'

const CORRECT_COLOR = '#16a34a'
const INCORRECT_COLOR = '#dc2626'

function pctOf(value, max) {
  return max ? Math.round((value / max) * 100) : 0
}

function toneFor(pct) {
  return pct >= 75 ? 'emerald' : pct >= 50 ? 'amber' : 'rose'
}

/** Circular ring showing an overall percentage — built with plain SVG so no extra chart lib is needed for it. */
function ScoreRing({ pct, size = 132, strokeWidth = 12 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, pct))
  const offset = circumference - (clamped / 100) * circumference
  const stroke = clamped >= 75 ? '#16a34a' : clamped >= 50 ? '#d97706' : '#dc2626'
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2e8f0" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-ink-900">{clamped}%</span>
      </div>
    </div>
  )
}

function CorrectDonut({ correct, incorrect, size = 130 }) {
  const total = correct + incorrect
  if (total === 0) {
    return <div className="flex h-[130px] items-center justify-center text-xs text-ink-400">No data yet</div>
  }
  const data = [
    { name: 'Correct', value: correct },
    { name: 'Incorrect', value: incorrect },
  ]
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={size} height={size}>
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius={size * 0.3} outerRadius={size * 0.48} paddingAngle={2} strokeWidth={0}>
            <Cell fill={CORRECT_COLOR} />
            <Cell fill={INCORRECT_COLOR} />
          </Pie>
          <Tooltip formatter={(v, n) => [`${v} (${Math.round((v / total) * 100)}%)`, n]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1.5 text-xs">
        <p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: CORRECT_COLOR }} /> Correct — {correct} ({Math.round((correct / total) * 100)}%)</p>
        <p className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: INCORRECT_COLOR }} /> Incorrect — {incorrect} ({Math.round((incorrect / total) * 100)}%)</p>
      </div>
    </div>
  )
}

function LabeledBar({ label, pct }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-36 shrink-0 truncate text-ink-600" title={label}>{label}</span>
      <ProgressBar value={pct} tone={toneFor(pct)} />
      <span className="w-10 shrink-0 text-right font-medium text-ink-700">{pct}%</span>
    </div>
  )
}

/** Groups a result's per-question breakdown by each question's primary (first) topic. */
function topicBreakdown(perQuestion) {
  const byTopic = {}
  for (const pq of perQuestion || []) {
    const topic = (Array.isArray(pq.topics) && pq.topics[0]) || 'General'
    if (!byTopic[topic]) byTopic[topic] = { total: 0, correct: 0 }
    byTopic[topic].total += 1
    if (pq.isCorrect) byTopic[topic].correct += 1
  }
  return Object.entries(byTopic)
    .map(([topic, v]) => ({ topic, total: v.total, correct: v.correct, pct: pctOf(v.correct, v.total) }))
    .sort((a, b) => b.pct - a.pct)
}

export default function StudentResults() {
  const { user } = useAuth()
  const [results, setResults] = useState([])
  const [details, setDetails] = useState({})
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    let cancelled = false
    api
      .get(`/results/student/${user._id}`)
      .then(async (res) => {
        const list = res.data.results
        if (cancelled) return
        setResults(list)
        // Load every result's per-question detail up front so the overview charts below can be
        // computed from real data instead of only summary numbers.
        const entries = await Promise.all(
          list.map((r) =>
            api
              .get(`/results/${r._id}`)
              .then((d) => [r._id, d.data])
              .catch(() => [r._id, null])
          )
        )
        if (cancelled) return
        const map = {}
        for (const [id, data] of entries) if (data) map[id] = data
        setDetails(map)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user._id])

  const resultsWithPct = useMemo(
    () => results.map((r) => ({ ...r, pct: pctOf(r.finalScore, r.maxScore) })),
    [results],
  )

  const overview = useMemo(() => {
    if (resultsWithPct.length === 0) return null
    const avgPct = Math.round(resultsWithPct.reduce((sum, r) => sum + r.pct, 0) / resultsWithPct.length)
    const totalCorrect = resultsWithPct.reduce((sum, r) => sum + (r.correctCount || 0), 0)
    const totalQuestions = resultsWithPct.reduce((sum, r) => sum + (r.totalQuestions || 0), 0)
    return {
      avgPct,
      count: resultsWithPct.length,
      totalCorrect,
      totalIncorrect: Math.max(0, totalQuestions - totalCorrect),
      latestGrade: resultsWithPct[0].grade,
    }
  }, [resultsWithPct])

  // Each exam's title is used as its "subject" bucket — this platform generates one exam per
  // subject, so grouping by title reflects real per-subject performance without fabricating data.
  const subjectPerformance = useMemo(() => {
    const bySubject = {}
    for (const r of resultsWithPct) {
      const name = r.assessment?.title || 'Exam'
      if (!bySubject[name]) bySubject[name] = { sum: 0, count: 0 }
      bySubject[name].sum += r.pct
      bySubject[name].count += 1
    }
    return Object.entries(bySubject)
      .map(([name, v]) => ({ name, pct: Math.round(v.sum / v.count) }))
      .sort((a, b) => b.pct - a.pct)
  }, [resultsWithPct])

  const history = useMemo(
    () =>
      [...resultsWithPct]
        .sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt))
        .map((r) => ({ name: (r.assessment?.title || 'Exam').slice(0, 16), pct: r.pct })),
    [resultsWithPct],
  )

  async function handleDownload(id) {
    setDownloadingId(id)
    try {
      const res = await api.get(`/results/${id}/report`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${id}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setDownloadingId(null)
    }
  }

  if (loading) return <SkeletonRows rows={4} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Your Results</h1>
        <p className="text-sm text-ink-500">Score, grade, and per-question feedback for each submitted MCQ assessment.</p>
      </div>

      {results.length === 0 ? (
        <EmptyState icon={Award} title="No results yet" description="Submit an exam to see your score here immediately." />
      ) : (
        <>
          <Card>
            <CardHeader title="Performance Overview" subtitle={`${overview.count} assessment${overview.count === 1 ? '' : 's'} completed`} />
            <div className="grid grid-cols-1 gap-8 p-5 lg:grid-cols-2">
              <div className="flex flex-col items-center gap-3 border-b border-ink-100 pb-6 text-center lg:border-b-0 lg:border-r lg:pb-0 lg:pr-8">
                <ScoreRing pct={overview.avgPct} />
                <Badge variant="brand">{overview.latestGrade}</Badge>
                <p className="text-xs text-ink-500">
                  {overview.count} assessment{overview.count === 1 ? '' : 's'} completed &middot; Avg {overview.avgPct}%
                </p>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-ink-400">Correct vs Incorrect</p>
                <CorrectDonut correct={overview.totalCorrect} incorrect={overview.totalIncorrect} />
              </div>
            </div>

            {subjectPerformance.length > 0 && (
              <div className="border-t border-ink-100 p-5">
                <p className="mb-3 text-xs font-semibold uppercase text-ink-400">Subject-wise Performance</p>
                <div className="space-y-2.5">
                  {subjectPerformance.map((s) => (
                    <LabeledBar key={s.name} label={s.name} pct={s.pct} />
                  ))}
                </div>
              </div>
            )}

            {history.length > 0 && (
              <div className="border-t border-ink-100 p-5">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase text-ink-400">
                  <TrendingUp className="h-3.5 w-3.5" /> Assessment History
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={history} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar dataKey="pct" fill="#0f766e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-ink-900">Assessment Results</h2>
            <div className="space-y-4">
              {resultsWithPct.map((r) => {
                const d = details[r._id]
                const perQuestion = d?.evaluation?.ai?.perQuestion || []
                const topics = topicBreakdown(perQuestion)
                const wrongCount = Math.max(0, (r.totalQuestions || 0) - (r.correctCount || 0))
                const passed = r.grade !== 'Unsatisfactory'
                const expanded = expandedId === r._id

                return (
                  <Card key={r._id}>
                    <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-ink-900">{r.assessment?.title}</h3>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {(r.assessment?.subjects || []).map((s) => s.name).join(', ') || r.assessment?.difficulty}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-400">{new Date(r.publishedAt).toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col items-start gap-1.5 sm:items-end">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={passed ? 'success' : 'danger'}>{passed ? 'PASS' : 'FAIL'}</Badge>
                          <Badge variant="brand">{r.grade}</Badge>
                        </div>
                        <p className="text-sm font-semibold text-ink-900">
                          {r.correctCount ?? '—'}/{r.totalQuestions ?? '—'} &middot; {r.pct}%
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t border-ink-100 px-5 py-4 sm:grid-cols-4">
                      <div className="rounded-lg bg-ink-50 p-3 text-center">
                        <p className="text-lg font-bold text-ink-900">{r.finalScore}/{r.maxScore}</p>
                        <p className="text-[11px] text-ink-500">Obtained / Total</p>
                      </div>
                      <div className="rounded-lg bg-emerald-50 p-3 text-center">
                        <p className="text-lg font-bold text-emerald-700">{r.correctCount ?? 0}</p>
                        <p className="text-[11px] text-emerald-600">Correct Answers</p>
                      </div>
                      <div className="rounded-lg bg-rose-50 p-3 text-center">
                        <p className="text-lg font-bold text-rose-700">{wrongCount}</p>
                        <p className="text-[11px] text-rose-600">Wrong Answers</p>
                      </div>
                      <div className="rounded-lg bg-brand-50 p-3 text-center">
                        <p className="text-lg font-bold text-brand-700">{r.pct}%</p>
                        <p className="text-[11px] text-brand-600">Percentage</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 border-t border-ink-100 p-5 lg:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase text-ink-400">Correct vs Wrong</p>
                        <CorrectDonut correct={r.correctCount || 0} incorrect={wrongCount} size={110} />
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase text-ink-400">Topic-wise Performance</p>
                        {topics.length === 0 ? (
                          <p className="text-xs text-ink-400">Loading topic breakdown...</p>
                        ) : (
                          <div className="space-y-2.5">
                            {topics.map((t) => (
                              <LabeledBar key={t.topic} label={t.topic} pct={t.pct} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3">
                      <button
                        onClick={() => setExpandedId(expanded ? null : r._id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline"
                      >
                        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {expanded ? 'Hide answer review' : 'View answer-by-answer review'}
                      </button>
                      <Button variant="secondary" icon={Download} loading={downloadingId === r._id} onClick={() => handleDownload(r._id)}>
                        Report
                      </Button>
                    </div>

                    {expanded && (
                      <div className="max-h-96 space-y-3 overflow-y-auto border-t border-ink-100 p-5">
                        {perQuestion.map((pq, i) => (
                          <div
                            key={i}
                            className={`rounded-lg border p-3 text-xs ${pq.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}
                          >
                            <div className="flex items-start gap-2">
                              {pq.isCorrect ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              ) : (
                                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                              )}
                              <div className="space-y-1">
                                <p className="font-medium text-ink-800">{pq.questionText}</p>
                                <p className="text-ink-600">
                                  Your answer: <span className="font-semibold">{pq.selectedOption || 'Not answered'}</span>
                                  {!pq.isCorrect && (
                                    <>
                                      {' '}&middot; Correct answer: <span className="font-semibold text-emerald-700">{pq.correctAnswer}</span>
                                    </>
                                  )}
                                  {' '}&middot; {pq.scoreAwarded}/{pq.maxMarks} marks
                                </p>
                                {pq.explanation && <p className="text-ink-500">{pq.explanation}</p>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
