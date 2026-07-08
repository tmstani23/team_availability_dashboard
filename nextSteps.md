PROJECT STATUS: Team Availability Dashboard — Auth Implementation 7/8/2026

COMPLETED (models updated, not yet committed at time of writing — verify before next session):
- Created UserBadge model (backend/src/models/UserBadge.ts) + interface in types/index.ts
  Fields: email, password (hashed, select: false), role ('admin'|'member'), teamMemberId (ref)
- Removed email from TeamMember model/interface (backend AND frontend types/index.ts) —
  email now lives only on UserBadge
- Added timestamps: true to all three schemas: TeamMember, WorkShift, UserBadge
- Frontend UserBadge interface intentionally omits password field — should never
  be sent to or stored in frontend

DESIGN DECISIONS MADE:
- Separate UserBadge model instead of adding auth fields to TeamMember — avoids
  password hash ever flowing through team-data API responses (e.g. GET /api/team-members)
- teamMemberId required on UserBadge — every user is a team member, no standalone
  admin-only accounts (simplicity choice for portfolio-scale app)
- Naming note: TeamMember.role = job title (e.g. "Engineer"), UserBadge.role =
  admin/member permission level — same field name, different meaning, be careful
- Chose email duplication (Option B: email lives on TeamMember for display AND
  UserBadge for login) over single-source-of-truth — requires GET /api/team-members
  to populate/join email from UserBadge by teamMemberId (NOT YET IMPLEMENTED)
- JWT auth chosen over session-based (fits stateless React+Express split, less new infra)

NEXT STEPS (in order):
1. Backend auth logic: bcrypt password hashing, JWT signing/verification, login route,
   auth middleware to protect admin-only routes
   >> SWITCH TO A MORE CAPABLE MODEL (Opus/extended thinking) BEFORE THIS STEP 
2. Update teamMembersRoutes.ts:
   - GET route: populate/join email from UserBadge
   - POST route: creating a team member should also create a linked UserBadge
     (similar to how it already auto-creates an initial WorkShift)
3. Frontend: real login flow replacing the simulated viewer dropdown in TeamContext
4. React Router setup:
   - /login
   - /dashboard (member view: ScheduleGrid + expanded sidebar)
   - /admin (AddTeamMemberForm + TeamMemberList with edit/delete), gated by role check
5. Status enum: TeamMember.isAvailable (boolean) → status field
   ('Active'/'Away'/'DND'/'Offline' per README) — do this alongside sidebar rework
6. Break logging UI (backend WorkShift.isBreak already exists, no frontend control yet)
7. Meeting overlap finder — pure frontend logic against existing shifts data,
   no model changes needed, can be done anytime independent of auth progress

DEFERRED / NOT STARTED:
- TeamStatusSidebar.tsx still uses position: fixed, not yet converted to Tailwind,
  still has overlap bug risk — explicitly deprioritized until sidebar rework (step 5)
- No real-time sync (Socket.io) — app refetches after each action