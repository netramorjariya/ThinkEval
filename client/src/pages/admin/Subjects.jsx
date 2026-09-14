import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Trash2, BookOpen, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import api, { apiErrorMessage } from '../../services/api'
import { Card, Button, Modal, Input, Textarea, EmptyState, SkeletonRows } from '../../components/ui'

export default function AdminSubjects() {
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    api
      .get('/subjects')
      .then((res) => setSubjects(res.data.subjects))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/subjects', form)
      toast.success('Subject created.')
      setModalOpen(false)
      setForm({ name: '', description: '' })
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this subject and its syllabus? This cannot be undone.')) return
    try {
      await api.delete(`/subjects/${id}`)
      toast.success('Subject deleted.')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Subjects</h1>
          <p className="text-sm text-ink-500">Reusable subjects. Attach up to 3 to any assessment.</p>
        </div>
        <Button icon={Plus} onClick={() => setModalOpen(true)}>
          New Subject
        </Button>
      </div>

      {loading ? (
        <SkeletonRows rows={4} />
      ) : subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects yet"
          description="Create a subject, then upload its syllabus so the AI can analyze it."
          action={<Button icon={Plus} onClick={() => setModalOpen(true)}>New Subject</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => (
            <Card key={s._id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <BookOpen className="h-4 w-4" />
                </div>
                <button onClick={() => handleDelete(s._id)} className="text-ink-300 hover:text-rose-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-ink-900">{s.name}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-ink-500">{s.description || 'No description.'}</p>
              <Link to={`/admin/syllabus?subjectId=${s._id}`}>
                <Button variant="secondary" className="mt-4 w-full" icon={FileText}>
                  Manage Syllabus
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Subject"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving}>Create</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Subject Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Database Management Systems" />
          <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional short description" />
        </form>
      </Modal>
    </div>
  )
}
