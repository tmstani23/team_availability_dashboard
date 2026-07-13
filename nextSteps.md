COMPLETED — React Router + role-based views (7/11/2026)

ROUTE STRUCTURE (implemented):
- /login — public, redirects by role if already authenticated (admin →
  /admin/schedule, member → /dashboard)
- /dashboard — protected, member view (ScheduleGrid + sidebar)
- /admin/schedule — protected + admin-only, same ScheduleGrid + sidebar
- /admin/manage — protected + admin-only, TeamMemberList + AddTeamMemberForm
- /admin index route redirects to /admin/schedule
- Unknown paths fall through to role-aware redirect logic (LoginRoute)

NEW FILES: ProtectedRoute.tsx (auth + optional requiredRole gate),
AdminLayout.tsx (tab nav + Outlet), ScheduleView.tsx, ManageView.tsx

BUGS FIXED ALONG THE WAY:
- AddTeamMemberForm.tsx was missing the password field + credentials:'include'
  (was fully non-functional - now fixed)
- TeamMemberCard.tsx edit save was missing credentials:'include', and still
  referenced member.email (removed - email lives only on UserBadge)
- Stale unique index on TeamMember.email (leftover from before the
  email/UserBadge split) was silently blocking creation of a 2nd+ member.
  Fixed: mongoose.syncIndexes() added to server.ts on startup, dev-only
  (NODE_ENV check) since it can lock a collection while rebuilding indexes -
  not something to run unattended in production. See PRODUCTION CHECKLIST below.

COMPLETED — Admin badge-info view (7/13/2026)
- New route: GET /api/team-members/:id/badge (authenticate + requireAdmin),
  returns { email, role } only, never password. Kept separate from the main
  GET / roster response on purpose — deliberately preserves the
  TeamMember/UserBadge separation rather than joining them.
- TeamMemberCard.tsx: "View Login Info" button, lazy-fetches on click
  (not preloaded with the member list), toggles visibility on repeat clicks
  without re-fetching

COMPLETED — Local-only admin bootstrap scripts
- backend/src/scripts/seedAdmin.ts and resetAdminPassword.ts — write directly
  to MongoDB to create/reset an admin account, bypassing the API (needed
  since POST /api/team-members requires an existing admin to call it — no
  way to create the first one through the app itself)
- Gitignored (backend/src/scripts/) — not committed, since they only run
  with direct DB credentials from .env, which is also gitignored

STYLING BACKLOG (grown since last review):
- TeamStatusSidebar.tsx — still inline styles + position:fixed, not
  Tailwind converted (known overlap-bug risk)
- TeamMemberCard.tsx — still inline styles, not Tailwind converted
- TeamMemberList.tsx — still inline styles, not Tailwind converted
- These three should likely be tackled together as one pass, not separately

NEXT STEPS (priority order):
1. Tailwind conversion pass — TeamStatusSidebar, TeamMemberCard,
   TeamMemberList (remove inline styles + position:fixed)
2. Frontend control for role promotion (PATCH /:id/role exists on backend,
   no UI yet — likely a dropdown/button on TeamMemberCard or a dedicated
   admin panel)
3. Break logging UI (backend WorkShift.isBreak field already exists, no
   frontend control)
4. Meeting overlap finder (pure frontend logic against existing shifts
   data, no model changes needed)

PRODUCTION DEPLOYMENT CHECKLIST (not started, revisit before going live):
- syncIndexes() is dev-only by design — before deploying, manually audit
  indexes (Compass or a real migration) instead of relying on this running
  automatically
- Testing is currently 0% implemented despite being listed as "Planned" in
  the README (Jest for auth logic, Supertest for API routes, Vitest+RTL for
  ScheduleGrid timezone logic) — treat as its own workstream, not something
  that happens as a side effect of feature work
- Audit .env / secrets handling for production config (JWT_SECRET rotation,
  MONGODB_URI, CORS origin currently hardcoded to localhost:5173)

KNOWN GAPS VS README (not started):
- No recurring weekly-hours pattern (one-time shift set at member creation only)
- No WebSocket/Socket.io real-time sync (refetches after each action)