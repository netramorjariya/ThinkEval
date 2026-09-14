import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { UploadCloud, Sparkles, Trash2, Eye, FileText, RefreshCw } from 'lucide-react'
import api, { apiErrorMessage } from '../../services/api'
import { Card, CardHeader, Button, Select, Modal, EmptyState, SkeletonRows, Badge } from '../../components/ui'

const statusVariant = { uploaded: 'neutral', analyzing: 'info', analyzed: 'success', failed: 'danger' }

export default function AdminSyllabus() {
  const [params] = useSearchParams()
  const [subjects, setSubjects] = useState([])
  const [syllabi, setSyllabi] = useState([])
  const [loading, setLoading] = useState(true)
  const [subjectId, setSubjectId] = useState(params.get('subjectId') || '')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [analyzingId, setAnalyzingId] = useState(null)
  const [preview, setPreview] = useState(null)

  function load() {
    setLoading(true)
    Promise.all([api.get('/subjects'), api.get('/syllabus')])
      .then(([s, sy]) => {
        setSubjects(s.data.subjects)
        setSyllabi(sy.data.syllabi)
        if (!subjectId && s.data.subjects[0]) setSubjectId(s.data.subjects[0]._id)
      })
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handleUpload(e) {
    e.preventDefault()
    if (!subjectId || !file) return toast.error('Select a subject and a file.')
    const formData = new FormData()
    formData.append('subjectId', subjectId)
    formData.append('file', file)
    setUploading(true)
    try {
      await api.post('/syllabus/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Syllabus uploaded. Run AI analysis next.')
      setFile(null)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  async function handleAnalyze(id) {
    setAnalyzingId(id)
    try {
      const res = await api.post(`/syllabus/${id}/analyze`)
      toast.success('Syllabus analyzed successfully.')
      setSyllabi((prev) => prev.map((s) => (s._id === id ? res.data.syllabus : s)))
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setAnalyzingId(null)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this syllabus?')) return
    try {
      await api.delete(`/syllabus/${id}`)
      toast.success('Syllabus deleted.')
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Syllabus Management</h1>
        <p className="text-sm text-ink-500">
          Upload PDF, DOCX, or TXT syllabi, then run AI analysis to extract topics and objectives. An assessment can draw
          MCQs from up to 3 syllabi at a time.
        </p>
      </div>

      <Card>
        <CardHeader title="Upload Syllabus" subtitle="One syllabus per subject — uploading again replaces the previous file." />
        <form onSubmit={handleUpload} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <Select label="Subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Select subject...</option>
            {subjects.map((s) => (
              <option key={s._id} value={s._id}>{s.name}</option>
            ))}
          </Select>
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-xs font-medium text-ink-700">File (PDF / DOCX / TXT)</span>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => setFile(e.target.files[0])}
              className="block w-full text-xs text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-xs file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" icon={UploadCloud} loading={uploading} className="w-full">Upload</Button>
          </div>
        </form>
      </Card>

      {loading ? (
        <SkeletonRows rows={3} />
      ) : syllabi.length === 0 ? (
        <EmptyState icon={FileText} title="No syllabi uploaded yet" description="Upload a syllabus above to get started." />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {syllabi.map((sy) => (
            <Card key={sy._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{sy.subject?.name}</p>
                  <p className="text-xs text-ink-500">{sy.originalName} · uploaded {new Date(sy.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant[sy.status]}>{sy.status}</Badge>
                {sy.status === 'analyzed' && <Badge variant="brand">{sy.analysis.topics.length} topics</Badge>}
                <Button variant="secondary" icon={Eye} onClick={() => setPreview(sy)}>Preview</Button>
                <Button
                  variant="secondary"
                  icon={sy.status === 'analyzed' ? RefreshCw : Sparkles}
                  loading={analyzingId === sy._id}
                  onClick={() => handleAnalyze(sy._id)}
                >
                  {sy.status === 'analyzed' ? 'Re-analyze' : 'Analyze'}
                </Button>
                <button onClick={() => handleDelete(sy._id)} className="rounded-lg p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.subject?.name} size="lg">
        {preview && (
          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-ink-400">Extracted Text (excerpt)</p>
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-xs text-ink-600">
                {preview.extractedText?.slice(0, 2000) || 'No text extracted.'}
              </p>
            </div>
            {preview.status === 'analyzed' && (
              <>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-ink-400">Topics</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.analysis.topics.map((t, i) => <Badge key={i} variant="brand">{t}</Badge>)}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-ink-400">Learning Objectives</p>
                  <ul className="list-inside list-disc space-y-1 text-xs text-ink-600">
                    {preview.analysis.learningObjectives.map((o, i) => <li key={i}>{o}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-ink-400">Practical Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.analysis.practicalSkills.map((s, i) => <Badge key={i} variant="success">{s}</Badge>)}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
