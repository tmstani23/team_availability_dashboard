ROUTING PLAN — React Router (added 7/11/2026, supersedes step 4 above)

ROUTE STRUCTURE:
- /login — public, redirects to /dashboard if already authenticated
- /dashboard — protected, member view (ScheduleGrid + sidebar)
- /admin/schedule — protected + admin-only, same ScheduleGrid + sidebar as member view
- /admin/manage — protected + admin-only, AddTeamMemberForm + TeamMemberList
  (schedule/manage are actual URL segments, not local tab state — bookmarkable,
  back button works, and sets the pattern for future routes like weekly-hours
  or meeting-overlap-finder to slot in later without a rework)

ACCESS CONTROL:
- New ProtectedRoute wrapper component, reads loading/isAuthenticated from
  AuthContext:
  - while loading (session check in flight on refresh) — render nothing/spinner,
    do NOT redirect yet, or already-logged-in users get bounced to /login
    before GET /auth/me resolves
  - not authenticated — redirect to /login
  - optional requiredRole prop — non-admin hitting /admin/* redirects to
    /dashboard (quiet redirect, not an explicit 403 page — backend already
    blocks the underlying data regardless)
- Mirrors backend's authenticate/requireAdmin — same shape, frontend layer is
  UX only, not a security boundary on its own

CHANGES NEEDED:
- npm install react-router-dom in frontend
- New: frontend/src/components/ProtectedRoute.tsx
- App.tsx: replace AuthGate's conditional render with <Routes> config;
  TeamProvider still only mounts inside protected routes, unchanged from today
- Likely new: frontend/src/components/AdminLayout.tsx or similar, to hold the
  Schedule/Manage tab nav for /admin/* routes

STATUS: planned, not yet implemented — will build after this session