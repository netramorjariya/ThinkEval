import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import api from '../../services/api'
import { Card, CardHeader, SkeletonRows, Badge, ProgressBar, EmptyState } from '../../components/ui'

export default function AdminAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/analytics/evaluator')
      .then((res) => setData(res.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonRows rows={6} />

  const questionStats = data?.questionStats || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Question Analytics</h1>
        <p className="text-sm text-ink-500">Per-question difficulty and performance across all evaluated submissions.</p>
      </div>

      {questionStats.length === 0 ? (
        <EmptyState title="No question analytics yet" description="Analytics populate once submissions have been AI-evaluated." />
      ) : (
        <Card>
          <CardHeader title="Question Performance" subtitle={`${questionStats.length} questions across published assessments`} />
          <div className="divide-y divide-ink-100">
            {questionStats.map((q) => (
              <div key={q.questionId} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink-800">{q.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">{q.difficulty}</Badge>
                    <Badge variant="brand">{q.attempts} attempts</Badge>
                  </div>
                </div>
                {q.averageScorePct !== null ? (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex-1"><ProgressBar value={q.averageScorePct} tone={q.averageScorePct < 40 ? 'rose' : q.averageScorePct < 70 ? 'amber' : 'emerald'} /></div>
                    <span className="w-12 text-right text-xs font-medium text-ink-600">{q.averageScorePct}%</span>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-ink-400">No attempts scored yet.</p>
                )}
                {q.suggestion && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                    <AlertCircle className="h-3.5 w-3.5" /> {q.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
