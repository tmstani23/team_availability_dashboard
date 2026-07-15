# Next Steps

Last updated: 2026-07-15

## COMPLETED — scheduleTime.ts extraction (7/15/2026)
- Pulled the inline dayjs timezone-conversion block out of ScheduleGrid.tsx
  (was lines ~77-92) into `resolveHourRangeInViewerTz`, a pure function in
  new file frontend/src/utils/scheduleTime.ts
- Also extracted the "find this member's current shift" lookup into
  `getCurrentShiftForMember` in the same file - was inline in ScheduleGrid
  as a `.filter()` + `.find()` pair
- Both are plain functions (no hooks, no context) so any component can
  import and call them directly - this is what makes them reusable for
  the Overlap Finder below without needing shared state/context
- Replaced the old -1/-1/false sentinel values with a single
  `HourRange | null` return - null means "nothing to render," no magic
  numbers to remember at call sites
- Fixed a type-narrowing gap this surfaced: currentShift is now checked
  directly before .startTime/.endTime access in the JSX, instead of
  relying on isStartOfShift (which only narrows hourRange) to imply it
- No behavior change - verified via manual script run against real
  dayjs output (overnight shift, no-shift, and cross-timezone cases)
- ScheduleGrid.tsx no longer imports dayjs directly

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
- getCurrentShiftForMember (see above) is now the single place this
  rework needs to touch - its internals will change from "grab the first
  shift record" to "resolve today's day-of-week + layer any break on top,"
  and every consumer (ScheduleGrid, TeamHoursPanel, overlap logic) picks
  up the new behavior automatically

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

### Meeting Overlap Finder: component shape + access
- No new context needed - the shared timezone/shift-lookup logic already
  lives in scheduleTime.ts as plain functions, callable from anywhere
- Selection state (which members are checked) will live in ScheduleView.tsx
  (the existing shared parent of ScheduleGrid + TeamStatusSidebar, used by
  both /dashboard and /admin/schedule) as local useState, passed down as
  props - not lifted into TeamContext, since it's local UI state for this
  view, not team data other screens need
- Two new/changed components under ScheduleView:
  - TeamHoursPanel (new): checkbox per member + their hours converted to
    the viewer's timezone (reuses resolveHourRangeInViewerTz +
    getCurrentShiftForMember) - doubles as both the roster display and
    the multi-select control, one component instead of two
  - ScheduleGrid (changed): gains one additional row rendered the same
    way as a member row, colored where every selected member is active -
    chosen over full-height vertical bands spanning all rows, since a
    row shares the exact same CSS grid track as the member rows and is
    guaranteed pixel-aligned, whereas bands would need to independently
    replicate ScheduleGrid's column math (120px name col, 55px/hour,
    2px gap) and risk drifting out of alignment if that math ever changes
- Access: no role restriction - open to any authenticated user, not just
  admins. Reasoning: this reads data that's already visible to every
  logged-in member (no new backend route, no new exposure - confirmed
  frontend-only in the original spec), and any member might want to check
  overlap with a colleague, not just a coordinator scheduling a group

## NEXT STEPS (priority order)

1. Build TeamHoursPanel - checkbox list + per-member hours in viewer's
   timezone, using getCurrentShiftForMember + resolveHourRangeInViewerTz
   from scheduleTime.ts

2. Lift selection state into ScheduleView.tsx (useState<string[]>) and
   pass down to both TeamHoursPanel and ScheduleGrid

3. Add the overlap row to ScheduleGrid - for each hour, active only if
   every selected member's hourRange covers that hour (needs an
   isHourInRange(range, hour) helper - can extract from ScheduleGrid's
   existing isHourActive ternary so both the grid and the overlap row
   share one implementation instead of two copies that could drift)

4. Recurring day-of-week shift model rework (see Decisions above) - bigger
   lift, own session: schema change, backend routes, getCurrentShiftForMember
   internals changing from "find one shift" to "resolve today's recurring
   shift"

5. Break logging UI - depends on #4 landing first (or at minimum depends
   on shift-lookup handling more than one shift-like record per member per
   day, which #4 also requires)

6. Live Availability Sidebar: 4-state status (Active/Away/DND/Offline) -
   replace TeamMember.isAvailable Boolean with a status enum, update
   toggleAvailability in TeamContext and the sidebar UI

## KNOWN ISSUES / TECH DEBT (tracked in README, repeated here for visibility)

- TeamStatusSidebar's "Simulating Active User" dropdown (TeamContext.
  viewerId) is leftover pre-auth code, disconnected from real auth
  (AuthContext.teamMemberId) - two sources of "who am I." Not fixed.
- ScheduleGrid (via getCurrentShiftForMember) only resolves one shift per
  member (first match found, no date filtering) - invisible today since
  each member has exactly one shift record, but will surface as soon as
  #4 or #5 above land.
- AddTeamMemberForm inputs use bg-zinc-800 on a bg-zinc-800 card - relies
  on border alone for separation. Deferred to design pass.
- Broader design pass (button colors, card polish) - explicitly deferred,
  not yet started.

## PRODUCTION DEPLOYMENT CHECKLIST (not started, revisit before going live)
- syncIndexes() is dev-only by design - before deploying, manually audit
  indexes (Compass or a real migration) instead of relying on this running
  automatically
- Testing is currently 0% implemented (Jest for auth logic, Supertest for
  API routes, Vitest+RTL for scheduleTime.ts's pure functions - now more
  straightforward to test given the extraction) - own workstream
- Audit .env / secrets handling for production config (JWT_SECRET
  rotation, MONGODB_URI, CORS origin currently hardcoded to
  localhost:5173)

## KNOWN GAPS VS README (not started)
- No WebSocket/Socket.io real-time sync (refetches after each action)