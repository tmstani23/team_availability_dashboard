import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  // Restricts this route to one role; anyone else redirects to /dashboard
  requiredRole?: 'admin' | 'member';
}

const ProtectedRoute = ({ requiredRole }: ProtectedRouteProps) => {
  const { isAuthenticated, loading, role } = useAuth();

  // Session check still in flight - don't redirect yet or refresh bounces logged-in users
  if (loading) {
    return null;
  }

  // No session - replace avoids a back-button loop into this same redirect
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Wrong role for this route - send to their actual dashboard, not a dead end
  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  // Passed all checks - render the matched nested route
  return <Outlet />;
};

export default ProtectedRoute;