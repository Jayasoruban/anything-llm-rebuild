import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Wrap any route that requires a logged-in user.
// Not authed → /login.  Fresh install (no users) → /setup.
export default function ProtectedRoute({ children }) {
  const { user, needsSetup, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400">
        Loading…
      </div>
    );
  }

  if (needsSetup) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}
