import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Archive, UploadCloud, CheckCircle2, Send, X } from 'lucide-react'
import api, { apiErrorMessage } from '../../services/api'
import { Card, CardHeader, Button, Dropzone, EmptyState, SkeletonRows } from '../../components/ui'

function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  const kb = bytes / 1024
  return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`
}

export default function ProjectSubmission() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [submission, setSubmission] = useState(null)
  const [loadingSubmission, setLoadingSubmission] = useState(false)
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api
      .get('/student/assignments')
      .then((res) => {
        const withProject = res.data.assignments.filter((a) => a.assessment?.requiresProject)
        setAssignments(withProject)
        if (withProject[0]) setSelectedId(withProject[0]._id)
      })
      .finally(() => setLoading(false))
  }, [])

  const selected = assignments.find((a) => a._id === selectedId)

  useEffect(() => {
    if (!selected) return
    setLoadingSubmission(true)
    setFile(null)
    api
      .get(`/submissions?assessmentId=${selected.assessment._id}`)
      .then((res) => setSubmission(res.data.submissions[0] || null))
      .finally(() => setLoadingSubmission(false))
  }, [selected])

  async function handleSubmit() {
    if (!file) return toast.error('Choose a ZIP file first.')
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('project', file)
      const res = await api.post(`/student/assignments/${selectedId}/submit-project`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('Project submitted successfully!')
      setSubmission(res.data.submission)
      setFile(null)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <SkeletonRows rows={4} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Project Submission</h1>
        <p className="text-sm text-ink-500">Submit your project as a ZIP archive for exams that require one — separate from the MCQ exam.</p>
      </div>

      {assignments.length === 0 ? (
        <EmptyState icon={Archive} title="No project submissions required" description="You'll see a submission form here once a faculty member enables a project component for one of your exams." />
      ) : (
        <>
          {assignments.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {assignments.map((a) => (
                <button
                  key={a._id}
                  onClick={() => setSelectedId(a._id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedId === a._id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  {a.assessment.title}
                </button>
              ))}
            </div>
          )}

          {selected && (
            <Card>
              <CardHeader title={selected.assessment.title} subtitle="Project requirements" />
              <div className="space-y-5 p-5">
                <p className="whitespace-pre-line rounded-lg bg-ink-50 px-3 py-2.5 text-sm text-ink-600">
                  {selected.assessment.projectRequirements || 'No specific requirements were provided — follow your course project brief.'}
                </p>

                {loadingSubmission ? (
                  <SkeletonRows rows={2} />
                ) : submission && submission.projectStatus !== 'not_submitted' ? (
                  <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <p className="text-sm font-semibold text-emerald-800">
                        {submission.projectStatus === 'evaluated' ? 'Project evaluated' : 'Project submitted — awaiting evaluation'}
                      </p>
                    </div>
                    <div className="text-xs text-emerald-800">
                      <p>{submission.project?.originalName} &middot; {formatBytes(submission.project?.sizeBytes)}</p>
                      <p className="mt-0.5 text-emerald-600">
                        Submitted {submission.projectSubmittedAt ? new Date(submission.projectSubmittedAt).toLocaleString() : ''}
                      </p>
                    </div>
                    {submission.projectStatus === 'evaluated' && (
                      <div className="rounded-lg bg-white p-3">
                        <p className="text-lg font-bold text-brand-600">{submission.projectScore} / {submission.projectMaxScore || 100}</p>
                        {submission.projectFeedback && <p className="mt-1 text-xs text-ink-600">{submission.projectFeedback}</p>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!file ? (
                      <Dropzone icon={UploadCloud} accept=".zip" hint="Accepted format: .zip" onFiles={(files) => setFile(files[0])} />
                    ) : (
                      <div className="flex items-center gap-3 rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2">
                        <Archive className="h-4 w-4 shrink-0 text-ink-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-ink-800">{file.name}</p>
                          <p className="text-[11px] text-ink-400">{formatBytes(file.size)}</p>
                        </div>
                        <button onClick={() => setFile(null)} className="rounded-md p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    <Button icon={Send} loading={submitting} disabled={!file} onClick={handleSubmit}>
                      Submit Project
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
