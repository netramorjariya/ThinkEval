import { Navigate, Route, Routes } from 'react-router-dom'
import {
  LayoutDashboard, ClipboardList, FolderKanban, GraduationCap,
  UserCheck, Award, BarChart3, Settings, CheckSquare, Archive,
} from 'lucide-react'

import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './layouts/DashboardLayout'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

import AdminDashboard from './pages/admin/Dashboard'
import AdminExams from './pages/admin/Exams'
import AdminProjects from './pages/admin/Projects'
import AdminSubjects from './pages/admin/Subjects'
import AdminSyllabus from './pages/admin/Syllabus'
import AdminAssessments from './pages/admin/Assessments'
import AdminAssessmentDetail from './pages/admin/AssessmentDetail'
import UserManagement from './pages/admin/UserManagement'
import AdminResults from './pages/admin/Results'
import AdminAnalytics from './pages/admin/Analytics'
import AdminSettings from './pages/admin/Settings'

import StudentDashboard from './pages/student/Dashboard'
import AssessmentTake from './pages/student/AssessmentTake'
import ProjectSubmission from './pages/student/ProjectSubmission'
import StudentResults from './pages/student/Results'

import EvaluatorDashboard from './pages/evaluator/Dashboard'
import EvaluatorSubmissions from './pages/evaluator/Submissions'
import EvaluatorEvaluate from './pages/evaluator/Evaluate'

// Simplified admin navigation — exam creation (syllabus upload + MCQ generation + review +
// publish) all lives under "Exams". Subjects/Syllabus/Assessments still exist as routes below for
// backward compatibility, but are no longer surfaced as separate nav items.
const adminNav = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/exams', label: 'Exams', icon: ClipboardList },
  { to: '/admin/projects', label: 'Projects', icon: FolderKanban },
  { to: '/admin/students', label: 'Students', icon: GraduationCap },
  { to: '/admin/evaluators', label: 'Evaluators', icon: UserCheck },
  { to: '/admin/results', label: 'Results', icon: Award },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

const evaluatorNav = [
  { to: '/evaluator/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/evaluator/submissions', label: 'Submissions', icon: CheckSquare },
  { to: '/evaluator/results', label: 'Results', icon: Award },
  { to: '/evaluator/analytics', label: 'Analytics', icon: BarChart3 },
]

const studentNav = [
  { to: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/student/project-submission', label: 'Project Submission', icon: Archive },
  { to: '/student/results', label: 'Results', icon: Award },
]

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={`/${user.role}/dashboard`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route element={<DashboardLayout navItems={adminNav} roleLabel="Admin Console" />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/exams" element={<AdminExams />} />
          <Route path="/admin/projects" element={<AdminProjects />} />
          {/* Kept mounted for backward compatibility; no longer linked from the sidebar. */}
          <Route path="/admin/subjects" element={<AdminSubjects />} />
          <Route path="/admin/syllabus" element={<AdminSyllabus />} />
          <Route path="/admin/assessments" element={<AdminAssessments />} />
          <Route path="/admin/assessments/:id" element={<AdminAssessmentDetail />} />
          <Route path="/admin/students" element={<UserManagement role="student" title="Students" description="Students who can be assigned assessments." />} />
          <Route path="/admin/evaluators" element={<UserManagement role="evaluator" title="Evaluators" description="Accounts with evaluation and review access." />} />
          <Route path="/admin/results" element={<AdminResults />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['evaluator', 'admin']} />}>
        <Route element={<DashboardLayout navItems={evaluatorNav} roleLabel="Evaluator Console" />}>
          <Route path="/evaluator/dashboard" element={<EvaluatorDashboard />} />
          <Route path="/evaluator/submissions" element={<EvaluatorSubmissions />} />
          <Route path="/evaluator/evaluate/:submissionId" element={<EvaluatorEvaluate />} />
          <Route path="/evaluator/results" element={<AdminResults />} />
          <Route path="/evaluator/analytics" element={<AdminAnalytics />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['student']} />}>
        <Route element={<DashboardLayout navItems={studentNav} roleLabel="Student Portal" />}>
          <Route path="/student/dashboard" element={<StudentDashboard />} />
          <Route path="/student/project-submission" element={<ProjectSubmission />} />
          <Route path="/student/results" element={<StudentResults />} />
        </Route>
        <Route path="/student/assessments/:id" element={<AssessmentTake />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
