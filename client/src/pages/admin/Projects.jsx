import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Download, ClipboardCheck, Save, FolderKanban } from 'lucide-react'
import api, { apiErrorMessage } from '../../services/api'
import { Card, CardHeader, Button, Select, Textarea, Badge, EmptyState, SkeletonRows } from '../../components/ui'

const projectStatusVariant = { not_submitted: 'neutral', submitted: 'info', evaluated: 'success' }
const projectStatusLabel = { not_submitted: 'Not submitted', submitted: 'Awaiting review', evaluated: 'Evaluated' }

export default function AdminProjects() {
  const [exams, setExams] = useState([])
  const [examId, setExamId] = useState('')
  const [loadingExams, setLoadingExams] = useState(true)

  const [requirements, setRequirements] = useState('')
  const [requiresProject, setRequiresProject] = useState(false)
  const [savingRequirements, setSavingRequirements] = useState(false)

  const [submissions, setSubmissions] = useState([])
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [scoreDrafts, setScoreDrafts] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)

  useEffect(() => {
    api
      .get('/assessments')
      .then((res) => {
        const published = res.data.assessments.filter((a) => a.status === 'published')
        setExams(published)
        if (published[0]) setExamId(published[0]._id)
      })
      .finally(() => setLoadingExams(false))
  }, [])

  const selectedExam = exams.find((e) => e._id === examId)

  useEffect(() => {
    if (!selectedExam) return
    setRequirements(selectedExam.projectRequirements || '')
    setRequiresProject(!!selectedExam.requiresProject)
  }, [selectedExam])

  function loadSubmissions() {
    if (!examId) return
    setLoadingSubmissions(true)
    api
      .get(`/submissions?assessmentId=${examId}`)
      .then((res) => setSubmissions(res.data.submissions))
      .finally(() => setLoadingSubmissions(false))
  }

  useEffect(loadSubmissions, [examId])

  async function handleSaveRequirements() {
    setSavingRequirements(true)
    try {
      const res = await api.patch(`/assessments/${examId}/project-requirements`, {
        projectRequirements: requirements,
        requiresProject,
      })
      toast.success(requiresProject ? 'Project requirements published to assigned students.' : 'Project requirements saved.')
      setExams((prev) => prev.map((e) => (e._id === examId ? res.data.assessment : e)))
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSavingRequirements(false)
    }
  }

  async function handleDownload(submissionId, fileName) {
    setDownloadingId(submissionId)
    try {
      const res = await api.get(`/submissions/${submissionId}/project/download`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || 'project.zip'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleEvaluate(submissionId) {
    const draft = scoreDrafts[submissionId] || {}
    const score = Number(draft.score)
    if (Number.isNaN(score) || score < 0 || score > 100) return toast.error('Score must be between 0 and 100.')

    setSavingId(submissionId)
    try {
      await api.patch(`/submissions/${submissionId}/project-evaluation`, { score, feedback: draft.feedback || '' })
      toast.success('Project evaluated.')
      loadSubmissions()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Projects</h1>
        <p className="text-sm text-ink-500">Set project requirements for a published exam and review student ZIP submissions.</p>
      </div>

      {loadingExams ? (
        <SkeletonRows rows={2} />
      ) : exams.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No published exams yet" description="Publish an exam from the Exams page before setting up a project component." />
      ) : (
        <>
          <Card>
            <CardHeader
              title="Project Requirements"
              subtitle="Enabling this makes the project workflow visible on the Project Submission page for every student already assigned to this exam."
            />
            <div className="space-y-4 p-5">
              <Select label="Exam" value={examId} onChange={(e) => setExamId(e.target.value)}>
                {exams.map((e) => <option key={e._id} value={e._id}>{e.title}</option>)}
              </Select>
              <Textarea
                label="Requirements / Instructions"
                rows={5}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="Describe what students should build and submit as a ZIP archive..."
              />
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={requiresProject} onChange={(e) => setRequiresProject(e.target.checked)} className="rounded border-ink-300" />
                Require a project submission for this exam
              </label>
              <Button icon={Save} loading={savingRequirements} onClick={handleSaveRequirements}>Save</Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Submissions" subtitle={selectedExam ? selectedExam.title : ''} />
            {loadingSubmissions ? (
              <div className="p-5"><SkeletonRows rows={3} /></div>
            ) : submissions.filter((s) => s.projectStatus && s.projectStatus !== 'not_submitted').length === 0 ? (
              <div className="p-5">
                <EmptyState icon={ClipboardCheck} title="No project submissions yet" description="Submissions will appear here once students upload their ZIP." />
              </div>
            ) : (
              <div className="divide-y divide-ink-100">
                {submissions
                  .filter((s) => s.projectStatus && s.projectStatus !== 'not_submitted')
                  .map((s) => (
                    <div key={s._id} className="space-y-3 px-5 py-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-semibold text-ink-800">
                          {s.student?.name} <span className="text-xs font-normal text-ink-400">({s.student?.studentId})</span>
                        </p>
                        <Badge variant={projectStatusVariant[s.projectStatus]}>{projectStatusLabel[s.projectStatus]}</Badge>
                        {s.projectSubmittedAt && (
                          <span className="text-xs text-ink-400">Submitted {new Date(s.projectSubmittedAt).toLocaleString()}</span>
                        )}
                        {s.projectStatus === 'evaluated' && (
                          <span className="ml-auto text-sm font-semibold text-brand-600">{s.projectScore} / {s.projectMaxScore || 100}</span>
                        )}
                        <Button
                          variant="secondary"
                          icon={Download}
                          loading={downloadingId === s._id}
                          onClick={() => handleDownload(s._id, s.project?.originalName)}
                          className={s.projectStatus === 'evaluated' ? '' : 'ml-auto'}
                        >
                          ZIP
                        </Button>
                      </div>

                      {s.projectStatus === 'evaluated' ? (
                        s.projectFeedback && <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">{s.projectFeedback}</p>
                      ) : (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            placeholder="Score / 100"
                            value={scoreDrafts[s._id]?.score ?? ''}
                            onChange={(e) => setScoreDrafts((d) => ({ ...d, [s._id]: { ...d[s._id], score: e.target.value } }))}
                            className="w-32 rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          />
                          <input
                            type="text"
                            placeholder="Feedback (optional)"
                            value={scoreDrafts[s._id]?.feedback ?? ''}
                            onChange={(e) => setScoreDrafts((d) => ({ ...d, [s._id]: { ...d[s._id], feedback: e.target.value } }))}
                            className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          />
                          <Button icon={Save} loading={savingId === s._id} onClick={() => handleEvaluate(s._id)}>Save Score</Button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
