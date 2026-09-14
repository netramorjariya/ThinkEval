import { useAuth } from '../../context/AuthContext'
import { Card, CardHeader, Badge } from '../../components/ui'

export default function AdminSettings() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Settings</h1>
        <p className="text-sm text-ink-500">Account and platform configuration.</p>
      </div>

      <Card>
        <CardHeader title="Profile" />
        <div className="grid grid-cols-1 gap-4 p-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-ink-400">Name</p>
            <p className="font-medium text-ink-800">{user?.name}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Email</p>
            <p className="font-medium text-ink-800">{user?.email}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">Role</p>
            <Badge variant="brand" className="capitalize">{user?.role}</Badge>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Platform" subtitle="ThinkEval — MCQ Exams & Project Evaluation Platform" />
        <div className="space-y-2 p-5 text-sm text-ink-600">
          <p>Maximum syllabi per exam: <strong>3</strong></p>
          <p>MCQs per exam: <strong>20</strong> · 5 marks each · <strong>100</strong> total marks · no negative marking</p>
          <p>Primary AI provider: <strong>Gemini</strong> (with Groq as optional fallback, configured via server .env)</p>
          <p>MCQ grading: fully deterministic on the backend — Gemini is never used to grade answers.</p>
        </div>
      </Card>
    </div>
  )
}
