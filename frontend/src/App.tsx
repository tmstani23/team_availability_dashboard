import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import LoginForm from './components/LoginForm';
import ScheduleView from './components/ScheduleView';
import ManageView from './components/ManageView';
import AdminLayout from './components/AdminLayout';
import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import HoursEditor from './components/HoursEditor';
import FirstRunHoursGate from './components/FirstRunHoursGate';
import { TeamProvider } from './context/TeamContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { homePathForRole } from './utils/routes';

// Kicks an already-logged-in user off /login straight to their dashboard,
// so a stale bookmark or back-navigation can't land them on the login form
function LoginRoute() {
  const { isAuthenticated, loading, role } = useAuth();
  if (loading) return null;
  // homePathForRole encodes the "admins need the tabbed layout" rule - see
  // that helper for why /dashboard is wrong for an admin
  if (isAuthenticated) {
    return <Navigate to={homePathForRole(role)} replace />;
  }
  return <LoginForm />;
}

// TeamProvider only mounts once ProtectedRoute confirms a session exists -
// same rule the old AuthGate followed, since its fetches require auth
function ProtectedLayout() {
  return (
    <TeamProvider>
      <Outlet />
      {/* Floats over whichever protected page is active - needs both
          AuthContext and TeamContext, both of which are live by this point */}
      <FirstRunHoursGate />
    </TeamProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />

        {/* Layer 1: must be logged in (any role) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<ProtectedLayout />}>
            {/* DashboardLayout wraps ScheduleView the same way AdminLayout
                wraps its children below - gives /dashboard an AppHeader
                (title + logout) without touching ScheduleView itself */}
            <Route path="/dashboard" element={<DashboardLayout />}>
              <Route index element={<ScheduleView />} />
            </Route>

            {/* Self-service hours, any authenticated role - reuses
                DashboardLayout purely for its shell (AppHeader, no tabs),
                nothing dashboard-specific about it */}
            <Route path="/profile" element={<DashboardLayout />}>
              <Route path="hours" element={<HoursEditor mode="self" />} />
            </Route>

            {/* Layer 2: nested inside layer 1, adds an admin-only check
                on top - a member hitting /admin/* bounces to /dashboard */}
            <Route element={<ProtectedRoute requiredRole="admin" />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route path="schedule" element={<ScheduleView />} />
                <Route path="manage" element={<ManageView />} />
                {/* Bare /admin with no sub-path defaults to the schedule tab */}
                <Route index element={<Navigate to="schedule" replace />} />
              </Route>

              {/* Admin editing a specific member's hours - not a tab under
                  AdminLayout (it's not part of the Schedule/Manage flow),
                  so it gets DashboardLayout's plain shell instead */}
              <Route path="/members/:id/hours" element={<DashboardLayout />}>
                <Route index element={<HoursEditor mode="admin" />} />
              </Route>
            </Route>
          </Route>
        </Route>

        {/* Unknown paths fall through to LoginRoute's logic, which sends
            admins to /admin/schedule, members to /dashboard, or /login if
            there's no session at all */}
        <Route path="*" element={<LoginRoute />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;