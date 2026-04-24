import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Setup from "./pages/Setup";
import Login from "./pages/Login";
import Workspace from "./pages/Workspace";
import LLMPreference from "./pages/Settings/LLMPreference";
import UserManagement from "./pages/Settings/UserManagement";
import Register from "./pages/Register";
import ProtectedRoute from "./components/ProtectedRoute";

const PublicOnly = ({ children }) => {
  const { user, needsSetup, loading } = useAuth();
  if (loading) return null;
  if (needsSetup) return <Navigate to="/setup" replace />;
  if (user) return <Navigate to="/workspace/default" replace />;
  return children;
};

const SetupOnly = ({ children }) => {
  const { needsSetup, loading } = useAuth();
  if (loading) return null;
  if (!needsSetup) return <Navigate to="/login" replace />;
  return children;
};

export default function App() {
  return (
    <Routes>
      <Route
        path="/setup"
        element={
          <SetupOnly>
            <Setup />
          </SetupOnly>
        }
      />
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route
        path="/workspace/:slug"
        element={
          <ProtectedRoute>
            <Workspace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/llm"
        element={
          <ProtectedRoute>
            <LLMPreference />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/users"
        element={
          <ProtectedRoute>
            <UserManagement />
          </ProtectedRoute>
        }
      />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Navigate to="/workspace/default" replace />} />
      <Route path="*" element={<Navigate to="/workspace/default" replace />} />
    </Routes>
  );
}
