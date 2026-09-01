import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './components/AdminLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SiteLayout } from './components/SiteLayout';
import { AuthProvider } from './lib/auth';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { AdminPostEditorPage } from './pages/AdminPostEditorPage';
import { AdminPostsPage } from './pages/AdminPostsPage';
import { AdminRegistrationsPage } from './pages/AdminRegistrationsPage';
import { AdminPlayersPage } from './pages/AdminPlayersPage';
import { AdminLocalitiesPage } from './pages/AdminLocalitiesPage';
import { AdminCategoriesPage } from './pages/AdminCategoriesPage';
import { AdminCourtsPage } from './pages/AdminCourtsPage';
import { AdminTournamentsPage } from './pages/AdminTournamentsPage';
import { HomePage } from './pages/HomePage';
import { PostPage } from './pages/PostPage';
import { RegistrationPage } from './pages/RegistrationPage';
import { SectionPage } from './pages/SectionPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/secciones/:section" element={<SectionPage />} />
            <Route path="/post/:slug" element={<PostPage />} />
            <Route path="/inscripcion" element={<RegistrationPage />} />
          </Route>
          <Route path="/app/login" element={<AdminLoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="contenidos" element={<AdminPostsPage />} />
              <Route path="contenidos/nuevo" element={<AdminPostEditorPage />} />
              <Route path="contenidos/:id" element={<AdminPostEditorPage />} />
              <Route path="inscripciones" element={<AdminRegistrationsPage />} />
              <Route path="jugadoras" element={<AdminPlayersPage />} />
              <Route path="localidades" element={<AdminLocalitiesPage />} />
              <Route path="categorias" element={<AdminCategoriesPage />} />
              <Route path="canchas" element={<AdminCourtsPage />} />
              <Route path="torneos" element={<AdminTournamentsPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
