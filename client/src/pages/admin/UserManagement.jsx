import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, Trash2, UserX, UserCheck } from 'lucide-react'
import api, { apiErrorMessage } from '../../services/api'
import { Card, Button, Modal, Input, EmptyState, SkeletonRows, Badge } from '../../components/ui'

export default function UserManagement({ role, title, description }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm(role))

  function load() {
    setLoading(true)
    api
      .get(`/users?role=${role}`)
      .then((res) => setUsers(res.data.users))
      .finally(() => setLoading(false))
  }

  useEffect(load, [role])

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/users', { ...form, role })
      toast.success(`${role === 'evaluator' ? 'Evaluator' : 'Student'} account created.`)
      setModalOpen(false)
      setForm(emptyForm(role))
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(u) {
    try {
      await api.patch(`/users/${u._id}/status`, { isActive: !u.isActive })
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this account? This cannot be undone.')) return
    try {
      await api.delete(`/users/${id}`)
      toast.success('Account deleted.')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900">{title}</h1>
          <p className="text-sm text-ink-500">{description}</p>
        </div>
        <Button icon={Plus} onClick={() => setModalOpen(true)}>Add {role === 'evaluator' ? 'Evaluator' : 'Student'}</Button>
      </div>

      {loading ? (
        <SkeletonRows rows={4} />
      ) : users.length === 0 ? (
        <EmptyState title={`No ${role}s yet`} description="Create an account to get started." action={<Button icon={Plus} onClick={() => setModalOpen(true)}>Add {role}</Button>} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-xs uppercase text-ink-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                {role === 'student' && <th className="px-4 py-3">Student ID</th>}
                {role === 'student' && <th className="px-4 py-3">Course / Sem / Sec</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {users.map((u) => (
                <tr key={u._id}>
                  <td className="px-4 py-3 font-medium text-ink-800">{u.name}</td>
                  <td className="px-4 py-3 text-ink-500">{u.email}</td>
                  {role === 'student' && <td className="px-4 py-3 text-ink-500">{u.studentId}</td>}
                  {role === 'student' && <td className="px-4 py-3 text-ink-500">{u.course} / {u.semester} / {u.section}</td>}
                  <td className="px-4 py-3">
                    <Badge variant={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Active' : 'Disabled'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => toggleActive(u)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100" title={u.isActive ? 'Disable' : 'Enable'}>
                        {u.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                      <button onClick={() => handleDelete(u._id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Add ${role === 'evaluator' ? 'Evaluator' : 'Student'}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving}>Create</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Full Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Password" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          {role === 'student' && (
            <>
              <Input label="Student ID" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} />
              <div className="grid grid-cols-3 gap-3">
                <Input label="Course" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} />
                <Input label="Semester" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} />
                <Input label="Section" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  )
}

function emptyForm(role) {
  return { name: '', email: '', password: '', studentId: '', course: '', semester: '', section: '' }
}
