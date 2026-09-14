import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, FileText, ArrowRight } from 'lucide-react'
import api, { apiErrorMessage } from '../../services/api'
import { Card, Button, Modal, Input, Select, EmptyState, SkeletonRows, Badge } from '../../components/ui'

const statusVariant = {
  draft: 'neutral',
  generating: 'info',
  generated: 'brand',
  failed: 'danger',
  published: 'success',
  closed: 'neutral',
}

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'VERY_HARD', 'EXPERT']

export default function AdminAssessments() {
  const [assessments, setAssessments] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', subjectIds: [], difficulty: 'HARD', durationMinutes: 90 })

  function load() {
    setLoading(true)
    Promise.all([api.get('/assessments'), api.get('/subjects')])
      .then(([a, s]) => {
        setAssessments(a.data.assessments)
        setSubjects(s.data.subjects)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  function toggleSubject(id) {
    setForm((prev) => {
      const exists = prev.subjectIds.includes(id)
      if (exists) return { ...prev, subjectIds: prev.subjectIds.filter((x) => x !== id) }
      if (prev.subjectIds.length >= 3) {
        toast.error('Maximum 3 subjects allowed per assessment.')
        return prev
      }
      return { ...prev, subjectIds: [...prev.subjectIds, id] }
    })
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (form.subjectIds.length === 0) return toast.error('Select at least one subject.')
    setSaving(true)
    try {
      await api.post('/assessments', form)
      toast.success('Assessment created. Now generate its 20 MCQs.')
      setModalOpen(false)
      setForm({ title: '', description: '', subjectIds: [], difficulty: 'HARD', durationMinutes: 90 })
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Assessments</h1>
          <p className="text-sm text-ink-500">Create 20-question MCQ assessments (100 marks, no negative marking) from up to 3 analyzed subjects.</p>
        </div>
        <Button icon={Plus} onClick={() => setModalOpen(true)}>New Assessment</Button>
      </div>

      {loading ? (
        <SkeletonRows rows={4} />
      ) : assessments.length === 0 ? (
        <EmptyState icon={FileText} title="No assessments yet" description="Create one from your analyzed subjects." action={<Button icon={Plus} onClick={() => setModalOpen(true)}>New Assessment</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {assessments.map((a) => (
            <Link to={`/admin/assessments/${a._id}`} key={a._id}>
              <Card className="flex flex-col gap-3 p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink-900">{a.title}</h3>
                    <Badge variant={statusVariant[a.status]}>{a.status}</Badge>
                    <Badge variant="neutral">{a.difficulty}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">
                    {a.subjects.map((s) => s.name).join(' + ')} · {a.durationMinutes} min
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-400" />
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Assessment"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving}>Create</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Assessment Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Q3 Software Engineering Case Challenge" />
          <div>
            <span className="mb-1 block text-xs font-medium text-ink-700">Subjects / syllabi (max 3) — must have an analyzed syllabus</span>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => (
                <button
                  type="button"
                  key={s._id}
                  onClick={() => toggleSubject(s._id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    form.subjectIds.includes(s._id) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Difficulty" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
            <Input label="Duration (minutes)" type="number" min={15} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
          </div>
          <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
            Every assessment generates exactly 20 MCQs worth 5 marks each (100 marks total, no negative marking).
          </p>
        </form>
      </Modal>
    </div>
  )
}
