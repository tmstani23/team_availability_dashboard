# Next Steps

Last updated: 2026-07-14

## COMPLETED — Auth lockdown on work-shifts + docs update (7/14/2026)
- work-shift routes (GET/POST/PUT/DELETE) were fully unauthenticated -
  fixed. GET now requires authenticate; POST/PUT/DELETE require
  authenticate + requireAdmin, matching the pattern already used in
  teamMembersRoutes.ts
- No frontend changes required - the only existing caller (TeamContext's
  GET) already sent credentials: 'include'; POST/PUT/DELETE had zero
  callers before this fix
- README.md rewritten to match actual current state (see below)

## DECISIONS MADE, NOT YET IMPLEMENTED

### Recurring shifts: day-of-week, not date-based
- Standing shifts will key off day-of-week (e.g. "Monday: 9-5") instead of
  a single date-based record, so a member isn't forced to work identical
  hours every day
- Deliberately NOT building a "week's worth of dated shifts" feature -
  rejected in favor of day-of-week recurrence, which needs no bulk-create
  flow and no "view next week" navigation
- No visual weekly view planned - ScheduleGrid keeps showing one day at a
  time; which shift displays just resolves automatically based on the
  current day of week
- This is a real schema fork, not a UI-only change: WorkShift.date makes
  sense for breaks (genuinely one-off, dated events) but not for standing
  shifts (recurring, not tied to a calendar date). The two record types
  will need to be modeled differently
- Who can edit: leaning toward self-service by default (member edits their
  own recurring hours) with admin able to override anyone's - same
  ownership-check shape as the existing PATCH /:id/status route (trust the
  JWT's teamMemberId, not a client-supplied id) - not finalized

### Breaks stay separate from recurring shifts
- Confirmed: breaks can't be recurring (a break is "something happening
  today," not a pattern), so they stay as dated, one-off WorkShift records
  even after standing shifts move to day-of-week recurrence
- Practical effect: ScheduleGrid will need to resolve TWO things per
  member per day - "today's recurring shift" and "today's break(s), if
  any" - and combine them, instead of finding one shift and stopping

### Live Availability Sidebar: 4-state status, not binary
- PRD calls for Active / Away / Do Not Disturb / Offline
- Currently TeamMember.isAvailable is a plain Boolean (Available/Away
  only) - would need to become a status enum
- Not started - noted in README as [In Progress]

## NEXT STEPS (priority order)

1. Extract shared "resolve this member's active hour-range, in the
   viewer's timezone" logic out of ScheduleGrid.tsx (currently inline,
   lines ~77-92: startHourViewer / endHourViewer / isOvernight
   calculation) into a reusable helper. Needed as a prerequisite for the
   overlap finder below, and will also be what ScheduleGrid itself
   eventually calls once shifts become day-of-week based.

2. Meeting Overlap Finder (frontend-only, no model changes)
   - UI: multi-select from existing roster
   - Logic: for each selected member, resolve their active hour-range
     using the helper above, then intersect across all selected members -
     an hour counts as overlap only if every selected member is active
   - Render: reuse ScheduleGrid's hour-block visual style, or something
     simpler
   - Confirmed this does NOT require a way to input/schedule an actual
     meeting - it's purely a query over existing shift data ("which hours
     is everyone already working"), not meeting creation

3. Recurring day-of-week shift model rework (see Decisions above) - bigger
   lift, own session: schema change, backend routes, ScheduleGrid lookup
   logic changing from "find one shift" to "resolve today's recurring
   shift"

4. Break logging UI - depends on #3 landing first (or at minimum depends
   on ScheduleGrid handling more than one shift-like record per member per
   day, which #3 also requires)

5. Live Availability Sidebar: 4-state status (Active/Away/DND/Offline) -
   replace TeamMember.isAvailable Boolean with a status enum, update
   toggleAvailability in TeamContext and the sidebar UI

## KNOWN ISSUES / TECH DEBT (tracked in README, repeated here for visibility)

- TeamStatusSidebar's "Simulating Active User" dropdown (TeamContext.
  viewerId) is leftover pre-auth code, disconnected from real auth
  (AuthContext.teamMemberId) - two sources of "who am I." Not fixed.
- ScheduleGrid only renders one shift per member (first match found, no
  date filtering) - invisible today since each member has exactly one
  shift record, but will surface as soon as #3 or #4 above land.
- AddTeamMemberForm inputs use bg-zinc-800 on a bg-zinc-800 card - relies
  on border alone for separation. Deferred to design pass.
- Broader design pass (button colors, card polish) - explicitly deferred,
  not yet started.

## PRODUCTION DEPLOYMENT CHECKLIST (not started, revisit before going live)
- syncIndexes() is dev-only by design - before deploying, manually audit
  indexes (Compass or a real migration) instead of relying on this running
  automatically
- Testing is currently 0% implemented (Jest for auth logic, Supertest for
  API routes, Vitest+RTL for ScheduleGrid timezone logic) - own workstream
- Audit .env / secrets handling for production config (JWT_SECRET
  rotation, MONGODB_URI, CORS origin currently hardcoded to
  localhost:5173)

## KNOWN GAPS VS README (not started)
- No WebSocket/Socket.io real-time sync (refetches after each action)