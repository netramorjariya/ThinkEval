import { useEffect, useState } from 'react'
import { Users, UserCheck, FileText, ClipboardCheck, Clock, CheckCircle2, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import api from '../../services/api'
import { StatCard, Card, CardHeader, Skeleton } from '../../components/ui'

// Distinct hues for a multi-category pie — teal leads (brand primary), the rest stay diverse so
// slices remain distinguishable; the old indigo is gone.
const PIE_COLORS = ['#0f766e', '#d97706', '#0ea5e9', '#dc2626', '#a16207']

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/analytics/admin')
      .then((res) => setData(res.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    )
  }

  const stats = data?.stats || {}
  const charts = data?.charts || {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Admin Dashboard</h1>
        <p className="text-sm text-ink-500">Overview of exams, projects, and evaluation progress.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Students" value={stats.totalStudents ?? 0} icon={Users} tone="brand" />
        <StatCard label="Total Evaluators" value={stats.totalEvaluators ?? 0} icon={UserCheck} tone="sky" />
        <StatCard label="Active Assessments" value={stats.activeAssessments ?? 0} icon={FileText} tone="emerald" />
        <StatCard label="Submitted Projects" value={stats.submittedProjects ?? 0} icon={ClipboardCheck} tone="amber" />
        <StatCard label="Pending Evaluations" value={stats.pendingEvaluations ?? 0} icon={Clock} tone="rose" />
        <StatCard label="Completed Evaluations" value={stats.completedEvaluations ?? 0} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Average Score" value={`${stats.averageScore ?? 0}%`} icon={TrendingUp} tone="brand" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Score Distribution" subtitle="Published results across all assessments" />
          <div className="h-64 p-4">
            {charts.scoreDistribution?.some((d) => d.count > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0f766e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No published results yet." />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Assessment Completion" subtitle="Submissions vs. assigned students" />
          <div className="h-64 p-4">
            {charts.assessmentCompletion?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.assessmentCompletion} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="title" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="completionPct" fill="#16a34a" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No published assessments yet." />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Subject Performance" subtitle="Average score per assessment" />
          <div className="h-64 p-4">
            {charts.subjectPerformance?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.subjectPerformance}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="assessment" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Bar dataKey="averageScore" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No evaluated submissions yet." />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Topic-wise Performance" subtitle="Average % score across all topics" />
          <div className="h-64 p-4">
            {charts.topicWisePerformance?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={charts.topicWisePerformance} dataKey="percentage" nameKey="topic" outerRadius={90} label={(d) => `${d.topic} (${d.percentage}%)`}>
                    {charts.topicWisePerformance.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No topic-level data yet." />
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

function EmptyChart({ label }) {
  return <div className="flex h-full items-center justify-center text-sm text-ink-400">{label}</div>
}
