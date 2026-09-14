import { useEffect, useState } from 'react'
import { Users, Clock, CheckCircle2, TrendingUp } from 'lucide-react'
import api from '../../services/api'
import { StatCard, SkeletonRows } from '../../components/ui'

export default function EvaluatorDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/analytics/evaluator')
      .then((res) => setData(res.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonRows rows={4} />

  const stats = data?.stats || {}

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Evaluator Dashboard</h1>
        <p className="text-sm text-ink-500">Track evaluation progress across all published assessments.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Assigned Students" value={stats.totalAssigned ?? 0} icon={Users} tone="brand" />
        <StatCard label="Pending Evaluations" value={stats.pendingEvaluations ?? 0} icon={Clock} tone="amber" />
        <StatCard label="Completed Evaluations" value={stats.completedEvaluations ?? 0} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Average Score" value={`${stats.averageScore ?? 0}%`} icon={TrendingUp} tone="sky" />
      </div>
    </div>
  )
}
