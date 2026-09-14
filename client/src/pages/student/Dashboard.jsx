import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayCircle, CheckCircle2, Award, Clock, FolderKanban, ArrowRight, ClipboardList, TrendingUp } from 'lucide-react'
import api from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Card, CardHeader, Badge, Button, EmptyState, SkeletonRows, StatCard } from '../../components/ui'

const statusVariant = { assigned: 'info', in_progress: 'warning', submitted: 'brand', evaluated: 'success', published: 'success' }
const statusLabel = { assigned: 'Not Started', in_progress: 'In Progress', submitted: 'Submitted', evaluated: 'Evaluated', published: 'Result Published' }
const projectStatusVariant = { not_submitted: 'warning', submitted: 'info', evaluated: 'success' }
const projectStatusLabel = { not_submitted: 'Not Submitted', submitted: 'Pending', evaluated: 'Evaluated' }

function pctOf(value, max) {
  return max ? Math.round((value / max) * 100) : 0
}

// A result "passes" using the same worst-tier check as the detailed Results page — no separate
// pass/fail threshold is invented here, it just reads the existing backend-assigned grade.
function passed(grade) {
  return grade !== 'Unsatisfactory'
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [results, setResults] = useState([])
  const [projectInfoByAssessment, setProjectInfoByAssessment] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.get('/student/assignments'), api.get(`/results/student/${user._id}`), api.get('/submissions')])
      .then(([assignmentsRes, resultsRes, submissionsRes]) => {
        setAssignments(assignmentsRes.data.assignments)
        setResults(resultsRes.data.results)
        const map = {}
        for (const s of submissionsRes.data.submissions) {
          map[String(s.assessment?._id || s.assessment)] = {
            projectStatus: s.projectStatus || 'not_submitted',
            projectScore: s.projectScore,
            projectMaxScore: s.projectMaxScore,
          }
        }
        setProjectInfoByAssessment(map)
      })
      .finally(() => setLoading(false))
  }, [user._id])

  const active = assignments.filter((a) => ['assigned', 'in_progress'].includes(a.status))
  const completed = assignments.filter((a) => ['submitted', 'evaluated', 'published'].includes(a.status))
  const projectAssignments = assignments.filter((a) => a.assessment?.requiresProject)
  // Results already come back sorted newest-first from the backend (publishedAt desc).
  const recentResults = results.slice(0, 5)
  const latestResult = results[0] || null

  const averageScorePct = useMemo(() => {
    if (results.length === 0) return null
    const sum = results.reduce((acc, r) => acc + pctOf(r.finalScore, r.maxScore), 0)
    return Math.round(sum / results.length)
  }, [results])

  const projectStatusSummary = useMemo(() => {
    if (projectAssignments.length === 0) return 'None required'
    const submittedCount = projectAssignments.filter(
      (a) => (projectInfoByAssessment[String(a.assessment._id)]?.projectStatus || 'not_submitted') !== 'not_submitted',
    ).length
    return `${submittedCount}/${projectAssignments.length} submitted`
  }, [projectAssignments, projectInfoByAssessment])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-sm text-ink-500">Here's what's on your plate today.</p>
      </div>

      {loading ? (
        <SkeletonRows rows={3} />
      ) : (
        <>
          {latestResult ? (
            <Card className="border-brand-200 bg-brand-50/50">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Latest Result</p>
                  <div className="mt-1.5 flex items-baseline gap-3">
                    <span className="text-3xl font-bold text-ink-900">{pctOf(latestResult.finalScore, latestResult.maxScore)}%</span>
                    <Badge variant="brand">{latestResult.grade}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{latestResult.assessment?.title}</p>
                </div>
                <Link to="/student/results">
                  <Button icon={Award}>View Result</Button>
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="p-5 text-sm text-ink-500">No results available yet.</Card>
          )}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Available Exams" value={active.length} icon={PlayCircle} tone="brand" />
            <StatCard label="Completed Exams" value={completed.length} icon={ClipboardList} tone="emerald" />
            <StatCard label="Average Score" value={averageScorePct === null ? '—' : `${averageScorePct}%`} icon={TrendingUp} tone="sky" />
            <StatCard label="Project Status" value={projectStatusSummary} icon={FolderKanban} tone="amber" />
          </div>

          <Card>
            <CardHeader title="Available Assessments" subtitle="Start or resume an MCQ exam" />
            {active.length === 0 ? (
              <div className="p-5"><EmptyState icon={PlayCircle} title="No active exams" description="Nothing assigned to you right now. Check back soon." /></div>
            ) : (
              <div className="divide-y divide-ink-100">
                {active.map((a) => (
                  <div key={a._id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-ink-900">{a.assessment.title}</h3>
                        <Badge variant={statusVariant[a.status]}>{statusLabel[a.status]}</Badge>
                        <Badge variant="neutral">{a.assessment.difficulty}</Badge>
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-500">
                        <span>{a.assessment.totalQuestions ?? 20} questions &middot; {a.assessment.totalMarks ?? 100} marks</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {a.assessment.durationMinutes} minutes</span>
                      </p>
                    </div>
                    <Link to={`/student/assessments/${a._id}`}>
                      <Button icon={PlayCircle}>{a.status === 'in_progress' ? 'Resume' : 'Start Exam'}</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Project Evaluation" subtitle="Separate from the MCQ exam" />
            {projectAssignments.length === 0 ? (
              <div className="p-5"><EmptyState icon={FolderKanban} title="No project required yet" description="This section activates once a faculty member enables a project component for one of your exams." /></div>
            ) : (
              <div className="divide-y divide-ink-100">
                {projectAssignments.map((a) => {
                  const info = projectInfoByAssessment[String(a.assessment._id)] || { projectStatus: 'not_submitted' }
                  return (
                    <div key={a._id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-ink-900">{a.assessment.title}</h3>
                        {info.projectStatus === 'evaluated' ? (
                          <p className="mt-0.5 text-xs text-ink-500">Score: {info.projectScore} / {info.projectMaxScore ?? 100}</p>
                        ) : (
                          <p className="mt-0.5 text-xs text-ink-500">Status: {projectStatusLabel[info.projectStatus]}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={projectStatusVariant[info.projectStatus]}>{projectStatusLabel[info.projectStatus]}</Badge>
                        <Link to="/student/project-submission">
                          <Button variant="secondary">{info.projectStatus === 'not_submitted' ? 'Submit Project' : 'View Details'}</Button>
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Recent Results"
              subtitle="Your latest MCQ scores"
              action={
                results.length > 0 && (
                  <Link to="/student/results">
                    <Button variant="secondary" icon={ArrowRight} className="flex-row-reverse">View All</Button>
                  </Link>
                )
              }
            />
            {recentResults.length === 0 ? (
              <div className="p-5"><EmptyState icon={CheckCircle2} title="No results available yet." description="Submit an exam to see your score here." /></div>
            ) : (
              <div className="divide-y divide-ink-100">
                {recentResults.map((r) => {
                  const pct = pctOf(r.finalScore, r.maxScore)
                  const pass = passed(r.grade)
                  return (
                    <div key={r._id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-ink-900">{r.assessment?.title}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                          <span className="flex items-center gap-1 font-medium text-ink-800">
                            <Award className="h-3.5 w-3.5 text-brand-500" /> {r.finalScore} / {r.maxScore}
                          </span>
                          <span>&middot;</span>
                          <span>{pct}%</span>
                          <span>&middot;</span>
                          <Badge variant="brand">{r.grade}</Badge>
                          <Badge variant={pass ? 'success' : 'danger'}>{pass ? 'Passed' : 'Failed'}</Badge>
                          <span>&middot;</span>
                          <span>{new Date(r.publishedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Link to="/student/results">
                        <Button variant="secondary">View Result</Button>
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
