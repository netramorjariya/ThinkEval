import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { GraduationCap, UserPlus, Check, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button, Input, PasswordInput } from '../../components/ui'
import { apiErrorMessage } from '../../services/api'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_RE = /^(?=.{4,6}$)(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/

const initialForm = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  studentId: '',
  course: '',
  semester: '',
  section: '',
}

function RequirementRow({ ok, label }) {
  return (
    <p className={`flex items-center gap-1.5 text-xs ${ok ? 'text-emerald-600' : 'text-ink-400'}`}>
      {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      {label}
    </p>
  )
}

export default function Register() {
  const { register, logout } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(initialForm)
  const [touched, setTouched] = useState({})
  const [loading, setLoading] = useState(false)

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }
  function markTouched(field) {
    return () => setTouched((t) => ({ ...t, [field]: true }))
  }

  const checks = useMemo(
    () => ({
      length: form.password.length >= 4 && form.password.length <= 6,
      upper: /[A-Z]/.test(form.password),
      number: /\d/.test(form.password),
      special: /[^A-Za-z0-9]/.test(form.password),
    }),
    [form.password],
  )
  const emailValid = EMAIL_RE.test(form.email.trim())
  const passwordValid = PASSWORD_RE.test(form.password)
  const passwordsMatch = form.confirmPassword.length > 0 && form.password === form.confirmPassword

  const emailError = touched.email && !emailValid ? 'Please enter a valid email address.' : ''
  const passwordError =
    touched.password && form.password && !passwordValid
      ? 'Password must be 4–6 characters and include an uppercase letter, a number, and a special character.'
      : ''
  const confirmError = touched.confirmPassword && form.confirmPassword && !passwordsMatch ? 'Passwords do not match.' : ''

  const canSubmit =
    form.name.trim() &&
    emailValid &&
    passwordValid &&
    passwordsMatch &&
    form.studentId.trim() &&
    form.course.trim() &&
    form.semester.trim() &&
    form.section.trim()

  async function handleSubmit(e) {
    e.preventDefault()
    setTouched({ email: true, password: true, confirmPassword: true })

    if (!form.name.trim()) return toast.error('Full name is required.')
    if (!emailValid) return toast.error('Please enter a valid email address.')
    if (!passwordValid) {
      return toast.error('Password must be 4–6 characters and include an uppercase letter, a number, and a special character.')
    }
    if (!passwordsMatch) return toast.error('Passwords do not match.')
    if (!form.studentId.trim() || !form.course.trim() || !form.semester.trim() || !form.section.trim()) {
      return toast.error('Please fill in all required fields.')
    }

    setLoading(true)
    try {
      const { confirmPassword: _confirmPassword, ...payload } = form
      // register() logs the new account in immediately (issues a token); sign back out right away
      // so the flow matches "create account, then log in" rather than skipping straight past login.
      await register({ ...payload, email: form.email.trim().toLowerCase() })
      logout()
      toast.success('Account created successfully. Please log in.')
      navigate('/login')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold text-ink-900">Create your student account</h1>
          <p className="mt-1 text-sm text-ink-500">Registration is for students only. Admin/Evaluator accounts are provisioned separately.</p>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Full Name" required value={form.name} onChange={update('name')} placeholder="Jane Doe" />
              <Input
                label="Email"
                type="email"
                required
                value={form.email}
                onChange={update('email')}
                onBlur={markTouched('email')}
                error={emailError}
                placeholder="you@college.edu"
              />
            </div>

            <div>
              <PasswordInput
                label="Password"
                required
                value={form.password}
                onChange={update('password')}
                onBlur={markTouched('password')}
                error={passwordError}
                placeholder="e.g. Ab1!"
              />
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-ink-50 p-3">
                <RequirementRow ok={checks.length} label="4–6 characters" />
                <RequirementRow ok={checks.upper} label="Uppercase letter" />
                <RequirementRow ok={checks.number} label="Number" />
                <RequirementRow ok={checks.special} label="Special character" />
              </div>
            </div>

            <PasswordInput
              label="Confirm Password"
              required
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              onBlur={markTouched('confirmPassword')}
              error={confirmError}
              placeholder="Re-enter password"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Student ID / Enrollment No." required value={form.studentId} onChange={update('studentId')} placeholder="STU2026099" />
              <Input label="Course" required value={form.course} onChange={update('course')} placeholder="B.Tech CSE" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Semester" required value={form.semester} onChange={update('semester')} placeholder="6" />
              <Input label="Section" required value={form.section} onChange={update('section')} placeholder="A" />
            </div>

            <Button type="submit" className="w-full" loading={loading} disabled={!canSubmit} icon={UserPlus}>
              Create Account
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-ink-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-brand-600 hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
