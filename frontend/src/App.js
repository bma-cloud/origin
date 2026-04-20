import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Domaines from './pages/Domaines';
import Outils from './pages/Outils';
import OutilPage from './pages/OutilPage';
import FlowChantier from './pages/FlowChantier';
import FicheChefDeFile from './pages/FicheChefDeFile';
import Fiches from './pages/Fiches';
import AuditLogs from './pages/AuditLogs';
import Profile from './pages/Profile';
import { Toaster } from './components/ui/sonner';
import AiAssistant from './components/AiAssistant';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f4f5]">
        <div className="w-10 h-10 border-2 border-[#D32F2F]/20 border-t-[#D32F2F] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role_global)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout>{children}</Layout>;
}

// Route protégée SANS Layout (pour les outils en plein écran)
function ProtectedRouteFullscreen({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f4f5]">
        <div className="w-10 h-10 border-2 border-[#D32F2F]/20 border-t-[#D32F2F] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role_global)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f4f5]">
        <div className="w-10 h-10 border-2 border-[#D32F2F]/20 border-t-[#D32F2F] rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute roles={['direction', 'encadrant']}>
            <Users />
          </ProtectedRoute>
        }
      />
      <Route
        path="/domaines"
        element={
          <ProtectedRoute>
            <Domaines />
          </ProtectedRoute>
        }
      />
      <Route
        path="/outils"
        element={
          <ProtectedRoute>
            <Outils />
          </ProtectedRoute>
        }
      />
      <Route
        path="/outils/:outilId"
        element={
          <ProtectedRoute>
            <OutilPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/outils/:outilId/flowchantier"
        element={
          <ProtectedRouteFullscreen>
            <FlowChantier />
          </ProtectedRouteFullscreen>
        }
      />
      <Route
        path="/audit-logs"
        element={
          <ProtectedRoute roles={['direction']}>
            <AuditLogs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fiches"
        element={
          <ProtectedRoute>
            <Fiches />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fiches/:code"
        element={
          <ProtectedRoute>
            <FicheChefDeFile />
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <AiAssistant />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
