import { Navigate, Route, Routes } from 'react-router';
import { useSession } from './api/hooks.js';
import { Spinner } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import CoursesPage from './pages/CoursesPage.jsx';
import CourseEditorPage from './pages/course/CourseEditorPage.jsx';
import CourseStatsPage from './pages/CourseStatsPage.jsx';
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx';
import TeachersPage from './pages/admin/TeachersPage.jsx';
import StudentsPage from './pages/admin/StudentsPage.jsx';
import StudentDetailPage from './pages/admin/StudentDetailPage.jsx';
import CodesPage from './pages/admin/CodesPage.jsx';
import EnrollmentsPage from './pages/admin/EnrollmentsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

function RequireAuth({ children }) {
  const { status } = useSession();
  if (status === 'loading') return <Spinner />;
  if (status !== 'authenticated') return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { isAdmin } = useSession();
  return isAdmin ? children : <Navigate to="/courses" replace />;
}

function Home() {
  const { isAdmin } = useSession();
  return <Navigate to={isAdmin ? '/admin' : '/courses'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="courses/:id" element={<CourseEditorPage />} />
        <Route path="courses/:id/stats" element={<CourseStatsPage />} />
        <Route path="admin" element={<RequireAdmin><AdminDashboardPage /></RequireAdmin>} />
        <Route path="admin/teachers" element={<RequireAdmin><TeachersPage /></RequireAdmin>} />
        <Route path="admin/students" element={<RequireAdmin><StudentsPage /></RequireAdmin>} />
        <Route path="admin/students/:id" element={<RequireAdmin><StudentDetailPage /></RequireAdmin>} />
        <Route path="admin/codes" element={<RequireAdmin><CodesPage /></RequireAdmin>} />
        <Route path="admin/enrollments" element={<RequireAdmin><EnrollmentsPage /></RequireAdmin>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
