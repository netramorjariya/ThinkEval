import { useEffect, useState } from 'react'
import { Download, Award } from 'lucide-react'
import toast from 'react-hot-toast'
import api, { apiErrorMessage } from '../../services/api'
import { Card, EmptyState, SkeletonRows, Badge, Button } from '../../components/ui'

export default function AdminResults() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState(null)

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

  useEffect(() => {
    api
      .get('/results')
      .then((res) => setResults(res.data.results))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Published Results</h1>
        <p className="text-sm text-ink-500">Final scores after evaluator review, across all assessments.</p>
      </div>

      {loading ? (
        <SkeletonRows rows={5} />
      ) : results.length === 0 ? (
        <EmptyState icon={Award} title="No published results yet" description="Results appear here after an evaluator publishes reviewed evaluations." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-xs uppercase text-ink-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Assessment</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3 text-right">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {results.map((r) => (
                <tr key={r._id}>
                  <td className="px-4 py-3 font-medium text-ink-800">{r.student.name} <span className="text-xs text-ink-400">({r.student.studentId})</span></td>
                  <td className="px-4 py-3 text-ink-600">{r.assessment.title}</td>
                  <td className="px-4 py-3 font-semibold text-ink-900">{r.finalScore} / {r.maxScore}</td>
                  <td className="px-4 py-3"><Badge variant="brand">{r.grade}</Badge></td>
                  <td className="px-4 py-3 text-ink-500">{new Date(r.publishedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="secondary" icon={Download} loading={downloadingId === r._id} onClick={() => handleDownload(r._id)}>PDF</Button>
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
