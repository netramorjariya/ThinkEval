import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { GraduationCap, LogIn } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button, Input, PasswordInput } from '../../components/ui'
import { apiErrorMessage } from '../../services/api'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [touched, setTouched] = useState({})
  const [loading, setLoading] = useState(false)

  const emailValid = EMAIL_RE.test(form.email.trim())
  const emailError = touched.email && !emailValid ? 'Please enter a valid email address.' : ''
  const passwordError = touched.password && !form.password ? 'Please enter your password.' : ''

  async function handleSubmit(e) {
    e.preventDefault()
    setTouched({ email: true, password: true })

    if (!emailValid) return toast.error('Please enter a valid email address.')
    if (!form.password) return toast.error('Please enter your password.')

    setLoading(true)
    try {
      const user = await login(form.email.trim().toLowerCase(), form.password)
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`)
      navigate(`/${user.role}/dashboard`)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold text-ink-900">ThinkEval</h1>
          <p className="mt-1 text-sm text-ink-500">University Examination &amp; Evaluation Platform</p>
        </div>

        <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-ink-900">Sign in to your account</h2>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              error={emailError}
              placeholder="you@college.edu"
            />
            <PasswordInput
              label="Password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              error={passwordError}
              placeholder="••••••"
            />
            <Button type="submit" className="w-full" loading={loading} icon={LogIn}>
              Sign In
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-ink-500">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-medium text-brand-600 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
