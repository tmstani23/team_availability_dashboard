# Next Steps

Last updated: 2026-07-24

## COMPLETED — Phase 8: derived-offline + default-away (7/24)
This closes the recurring-shift workstream (#1). Two changes that turned out
to be the same idea: a status should never assert more than we actually know.

DECISION (revised from the original plan): the default STORED status is now
'away', not 'active'. 'active' is a claim that someone is present and
available, and only the person can make it truthfully - a member an admin
creates at 3am who has never logged in hasn't asserted anything. This also
dissolved the open question logged above about unset members: a brand-new
member now reads as "Away" + "Hours not set" with NO unset-specific
derivation rule needed. Backend model default changed; existing members are
unaffected (they carry explicit values from migrateStatus.ts), so no
migration.

Full precedence, highest first:
  1. off-shift          -> 'offline'  (derived, overrides what they set)
  2. whatever they set  -> as-is
  3. never set anything -> 'away'

- New getScheduleState(resolution, memberTimezone, now?) in scheduleTime.ts
  returns 'on-shift' | 'off-shift' | 'unknown'. IMPORTANT: off-shift is NOT
  just isOff days - a member with Wed 9-5 set is also off shift at 8pm
  Wednesday, so this compares their actual local clock against their hours.
  Minute-accurate (not hour-bucketed like the grid): finishing at 17:00 means
  17:30 reads as off. Half-open [start,end) matching isHourInRange, overnight
  handled as the union of both pieces. Malformed times / missing tz fall back
  to 'unknown', deliberately NOT 'off-shift' - a NaN comparison is silently
  false and would otherwise read as "not working."
- New resolveDisplayStatus(storedStatus, scheduleState) in status.ts. Kept in
  status.ts, not scheduleTime.ts, so the split stays clean: time logic answers
  "where are they in their schedule," status logic answers "what do we show."
  No dayjs in status.ts.
- 'unknown' does NOT derive offline. No hours on file means we know nothing
  about their schedule, which is different from knowing they're off - the
  "Hours not set" label carries that instead.
- TeamStatusSidebar + TeamMemberCard both render the DERIVED status, so the
  member and admin views can't disagree. The picker still highlights the
  STORED value (that row answers "what did I choose"). Added a note on your
  own row when derivation overrides a real choice - without it, clicking
  Active while off shift looks like the button did nothing.
- Tests: 9 new cases in scheduleTime.test.ts (getScheduleState boundaries,
  overnight, member-tz-not-viewer-tz, off vs unset, malformed fallbacks) plus
  resolveDisplayStatus precedence. Vitest still can't run in the Linux sandbox
  (native bindings) - verified via a compiled-JS harness instead, 21/21 green,
  same pattern used for the Phase 4/5 work. RUN `npm run test:run` ON WINDOWS
  to confirm.
- tsc -b clean.

## COMPLETED — Unset-hours visibility (7/24)
Caught in manual QA: a new member with no hours renders an EMPTY grid row,
which reads as "not working today" - a different fact from "never set up."
The three consumers had drifted apart on this:
- TeamHoursPanel already distinguished Off / Not set (correct).
- TeamStatusSidebar showed "Off today" for off, the amber CTA for your OWN
  unset, and NOTHING for anyone else's unset.
- ScheduleGrid rendered off and unset identically (both are a null hourRange).
Root cause of the sidebar gap was conflating two separate things in the
Phase 7 decision: the CTA (actionable, correctly self-only) and the state
LABEL (informational, everyone's business). Split them - your own row keeps
the amber "Hours not set — set now" link, everyone else's gets a plain amber
"Hours not set" label.
ScheduleGrid's memberRows now carries `resolution` alongside hourRange (off
and unset both yield a null range, so only resolution.state can tell them
apart) and the 120px name column gets a muted second line: "Off today" or
"Hours not set". Chosen over distinct cell styling for unset rows - no
changes to the cell rendering or column math, which the overlap row depends
on staying pixel-aligned with.
tsc -b clean.

OPEN QUESTION this raises for Phase 8: an unset member currently shows their
stored manual status, which defaults to 'active' - so a brand-new member who
has never set hours reads as "Active" in the sidebar. Decide during Phase 8
whether unset should derive to offline like off-shift does, or stay distinct
(arguably "we don't know" is not the same claim as "not working").

## COMPLETED — Phase 6/7 review fixes (7/24, same day)
Manual QA + self-review of the Phase 6/7 work turned up five issues:
- REGRESSION (caught in manual QA): HoursEditor's Back link sent self-mode
  users to /dashboard unconditionally, which strands an ADMIN - only
  AdminLayout renders the Schedule/Manage tabs, so an admin who clicked
  "My Hours" then Back lost all access to the Manage tab. This is the exact
  trap App.tsx's LoginRoute comment already warned about. Fixed by extracting
  homePathForRole() into new frontend/src/utils/routes.ts and using it in
  BOTH LoginRoute and HoursEditor, so the rule lives in one place instead of
  being restated (and forgotten) per call site.
- No way out of the hours page at all - added a Back link (admin mode returns
  to /admin/manage, self mode to homePathForRole(role)). Explicit paths, not
  navigate(-1), since history is unreliable when the page is opened directly.
- Stale grid after save: TeamContext only fetches on mount and route changes
  don't remount TeamProvider, so saved hours didn't show up until a manual
  refresh. handleSave now awaits refreshAllData().
- GET /hours error responses parse as a { message } object, not the expected
  array - the for...of would throw something unrelated. Added an res.ok check
  so the real error surfaces.
- "Hours saved" banner lingered while making new edits; updateDay now clears
  it. FirstRunHoursGate also hid itself on /profile/hours (it was floating
  over the page it points at).
- tsc -b clean after all of the above.

## COMPLETED — Recurring shifts: Phase 6 + 7 (7/24)
- New HoursEditor.tsx component (frontend/src/components/HoursEditor.tsx):
  one component driven by a `mode: 'self' | 'admin'` prop - self reads the
  target member from AuthContext.teamMemberId, admin reads it from the :id
  route param. Both paths call the same GET/PUT /api/team-members/:id/hours
  (routes already existed from the backend phase). 7 rows (Mon-first display
  order, values still 0-6 DayOfWeek underneath), each an Off checkbox or a
  start/end time pair. Unset days default to a prefilled 9-5 rather than
  blank inputs, so hitting Save on an untouched row produces a valid working
  day instead of a validation error. Save does one whole-week PUT, matching
  the route's replace-not-patch contract.
- Carried the exact shift-granularity validation from the old
  AddTeamMemberForm (start<end, on-the-hour, >=60min) into HoursEditor - the
  grid renders in whole-hour blocks, so this constraint has to live wherever
  times get written, not just at member creation.
- Routes added in App.tsx: /profile/hours (self, inside the "any authed
  role" layer) and /members/:id/hours (admin, nested inside the existing
  admin-only ProtectedRoute layer). Both reuse DashboardLayout purely for its
  shell (AppHeader, no tabs) - neither is part of the Schedule/Manage tab
  flow AdminLayout represents.
- Entry points: "My Hours" link in AppHeader (visible to every logged-in
  user, not just admins - everyone has hours to manage) and an "Edit Hours"
  button on each card in TeamMemberCard (admin -> /members/:id/hours).
- AddTeamMemberForm cleanup: removed startTime/endTime fields, their
  validation block, and the stale comment claiming the backend creates an
  initial WorkShift (it hasn't since the backend phase - POST /team-members
  no longer does that). Members now start with zero RecurringShift records
  and fill their own week via /profile/hours, matching the self-service
  seeding decision below.
- First-run gate: new FirstRunHoursGate.tsx, mounted once in App.tsx's
  ProtectedLayout (alongside Outlet, inside TeamProvider) so it floats over
  both /dashboard and /admin/* without being tied to either layout. Shows a
  dismissible bottom-right card when the logged-in member has zero
  RecurringShift records at all. Dismissal is in-memory only (component
  state) - reappears next login/reload by design, matches the "non-blocking"
  framing in the decision below rather than a permanent "seen it" flag.
  Exported shiftMemberId from scheduleTime.ts (was a private helper) so this
  and getCurrentShiftForMember share the same "does this shift belong to
  member X" logic instead of two copies drifting apart.
- Persistent CTA: TeamStatusSidebar's unset branch (previously rendered
  nothing) now shows an amber "Hours not set — set now" chip linking to
  /profile/hours, only on the logged-in member's own row (isSelf) - other
  members' unset rows stay silent, matching the decision that this isn't
  your hours to fix.
- tsc -b clean. eslint clean (npx eslint . run directly, no errors).
  Vitest still can't run in the Linux sandbox (native bindings) - run
  `npm run test:run` on Windows to confirm nothing broke; no scheduleTime.ts
  behavior changed, only a new export, so existing tests should be
  unaffected, but worth confirming.

## COMPLETED — Recurring shifts frontend cutover: Phase 4 + 5 (7/21)
- scheduleTime.ts rewritten:
  - getCurrentShiftForMember now takes (memberId, recurringShifts,
    memberTimezone, now?) and returns a ShiftResolution tagged union -
    { working, startTime, endTime } | { off } | { unset }. Replaces the old
    "first WorkShift record or undefined," which couldn't tell off from unset.
  - Resolves by the MEMBER'S OWN local weekday (now.tz(memberTz).day()), NOT
    the viewer's. DECISION (resolves the open sub-decision): this is a presence
    tool, so each row answers "on shift where they are." Viewer-tz conversion
    is a separate later step, so we keep both - correct day AND viewer's clock.
    Near a date boundary a member can legitimately show a different weekday
    than the viewer.
  - resolveHourRangeInViewerTz now takes the ShiftResolution and anchors its
    tz conversion to TODAY's date in the member's tz (now?), since recurring
    records carry no date and dropping it would break the DST offset. Returns
    null for anything that isn't a working shift.
  - isHourInRange / formatHourLabel / formatHourRange unchanged.
- scheduleTime.test.ts rewritten: `now` pinned per test for determinism; kept
  the cross-tz, overnight, and DST-pair cases; added working/off/unset and the
  member's-own-weekday boundary case (Fri 23:00 UTC = Sat in Tokyo). Verified
  all assertions pass against the compiled source (Vitest can't run in the
  Linux sandbox - node_modules has Windows/native bindings - so run
  `npm run test:run` on Windows to confirm; logic was checked via a
  compiled-JS harness, 31/31 green).
- TeamContext: swapped the /api/work-shifts fetch for /api/recurring-shifts;
  exposes `recurringShifts: RecurringShift[]` (was `shifts: any[]`). This is
  the FE cutover the migration was waiting on - old date-based WorkShift
  records can now be dropped from the dev DB whenever convenient.
- Repointed ScheduleGrid, TeamHoursPanel, TeamStatusSidebar to the new API.
  Panel chips now show Off / Not set (not a generic "No shift"); sidebar shows
  "Off today" for off days; unset shows nothing yet (its CTA is Phase 7).
- tsc -b is clean. Bycatch fix: TeamStatusSidebar's roster map was typed
  `member: any`, which tripped TS7053 on STATUS_META[member.status] (a
  pre-existing error, present on HEAD - build was red before this). Typed it
  as TeamMember. Callable out into its own commit if you'd rather.

## COMPLETED — Recurring shifts backend: model + migration + routes (7/21)
- New RecurringShift model: one record per member per dayOfWeek (0=Sun..6=Sat),
  optional startTime/endTime, isOff flag, unique index {teamMemberId,
  dayOfWeek}. Times required by the route only when isOff=false. RecurringShift
  + DayOfWeek types mirrored in backend + frontend.
- migrateToRecurringShifts.ts RAN against dev DB: seeded each member's old
  standing hours Mon-Fri, weekends off (28 records / 4 members, verified).
  Idempotent. Old WorkShift records LEFT in place - drop after FE cutover.
- Routes: GET /api/recurring-shifts (bulk, any auth); GET+PUT
  /api/team-members/:id/hours (self-or-admin whole-week replace, JWT-keyed like
  /status). Removed initial-WorkShift creation from POST /team-members (members
  now start unset).
- Nothing reads RecurringShift yet - app behaves as before until Phase 4/5.

## COMPLETED — scheduleTime.ts unit tests (7/20/2026)
- Vitest installed (frontend devDep, node env - no RTL/jsdom, these are
  pure functions). Scripts: `npm test` (watch), `npm run test:run` (once).
- New frontend/src/utils/scheduleTime.test.ts - 20 tests, all passing:
  - resolveHourRangeInViewerTz: null guards, same-tz passthrough, cross-tz
    (NY->LA), cross-tz overnight wraparound (Tokyo->LA), and a DST-sensitive
    pair (NY->UTC in Jan vs Jul) proving the conversion respects the date
  - isHourInRange: null, normal half-open [start,end), overnight OR-logic
  - getCurrentShiftForMember: string vs populated teamMemberId, no-match,
    incomplete-record skip - locks CURRENT "first valid shift" behavior as a
    regression net before #1 rewrites it
  - formatHourLabel / formatHourRange: midnight/noon, null placeholder
- Expected tz values were verified against real dayjs output before writing.
- This clears the #0 prerequisite; #1 is now unblocked.

## COMPLETED — Status enum: manual layer (7/18/2026)
- TeamMember.isAvailable Boolean replaced with a status enum
  ('active' | 'away' | 'dnd' | 'offline'), default 'active', in both the
  backend model/types and frontend types
  (SUPERSEDED 7/24: default is now 'away' - see Phase 8 at top for why)
- Backend PATCH /:id/status validates against SETTABLE_STATUSES
  (active/away/dnd only) - 'offline' is rejected because it's schedule-derived
- migrateStatus.ts backfilled existing members (true->active, false->away)
  via the raw collection, then dropped isAvailable - HAS BEEN RUN against dev DB
- Shared frontend/src/utils/status.ts holds STATUS_META (label/short/pill) and
  SETTABLE_STATUSES, used by both TeamStatusSidebar and TeamMemberCard so
  colors/labels can't drift
- toggleAvailability -> setStatus(id, status) in TeamContext, keeping the
  optimistic-update + rollback pattern (rollback now captures previous status
  first, since a 4-state value has no single "opposite" to flip back to)
- Sidebar's "can I edit this" now keys off real auth (AuthContext.teamMemberId),
  not the viewerId simulation - resolves half the "two sources of who am I"
  tech-debt item. Single toggle replaced with a 3-button picker.
- STILL TODO for this feature: the derived-offline layer - lands with #1
  below (needs reliable "on shift right now"). Until then, no member ever
  auto-shows offline; status is manual-only.
  DONE 7/24 - see Phase 8 at top. This feature is now complete.

## COMPLETED — Meeting Overlap Finder (by 7/18/2026)
- TeamHoursPanel built: checkbox chip per member with hours converted to the
  viewer's timezone, reusing getCurrentShiftForMember + resolveHourRangeInViewerTz
- Selection state lifted into ScheduleView.tsx as useState<string[]>, passed
  down as props to both TeamHoursPanel and ScheduleGrid (not TeamContext, per
  the original decision below)
- isHourInRange(range, hour) extracted into scheduleTime.ts, handling overnight
  wraparound - shared by both ScheduleGrid's member rows and the new overlap row
- Overlap row added to ScheduleGrid: renders only when selectedIds is non-empty,
  lit for an hour only when every selected member's hourRange covers it
- Matches the component-shape decisions recorded below (no new backend route,
  open to any authenticated user, one shared grid template for pixel alignment)

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

### Recurring shifts: day-of-week, not date-based — ALL IMPLEMENTED (7/24)
Kept as the decisions log / rationale for why the shipped design looks the
way it does. Nothing below is outstanding.
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

- OPEN QUESTIONS - RESOLVED 7/21/2026 (decisions below, ready for #1):
  - "Day off" representation: EXPLICIT off record, via an isOff boolean
    flag on the standing-shift record (NOT null start/end times). The flag
    lets getCurrentShiftForMember cleanly distinguish three states:
    on-shift (record with times), off-today (record, isOff:true), and
    never-set-up (no record for that weekday). Null times would blur the
    last two back together, defeating the point.
  - Where hours are set: per-member hours page, 7 weekday rows, each a
    time range or an "off" toggle. Self-service at /profile/hours; admin
    reaches the same page for anyone at /members/:id/hours. (Confirmed -
    no real alternative.)
  - Self-service edit route: single PUT /api/team-members/:id/hours that
    REPLACES the whole week at once (array of 7), not per-day PATCHes -
    matches the "save my week" UX and avoids partial-update races. Auth
    mirrors PATCH /:id/status: :id must equal the JWT's teamMemberId
    unless the caller is admin. Breaks stay on the existing dated
    /api/work-shifts routes - this route does not touch them.
  - Initial seeding: SELF-SERVICE. Hours start empty at member creation
    (AddTeamMemberForm stays lightweight, no weekday grid). Members fill
    their own week after first login. Deliberately leans on the
    "never set up" state, which the explicit-off decision makes cleanly
    queryable (zero standing-shift records == unset).
  - First-run gate (new, from the seeding decision): on login, if the
    member has zero standing-shift records, show a DISMISSIBLE prompt.
    Yes -> route to /profile/hours. No -> continue to the normal grid
    with their hours rendered as "unset." Non-blocking by design - lives
    as a conditional in the existing ProtectedRoute redirect spot, reuses
    the hours page (no separate page).
  - Persistent "set your hours" CTA (new): standing, obvious affordance on
    the member's OWN row in TeamStatusSidebar - the row already keys off
    AuthContext.teamMemberId, so "you, and unset" is a condition it
    already knows. Prefer a highlighted/interactive "Hours not set" chip
    (e.g. amber) over literal flashing; if any motion is used, respect
    prefers-reduced-motion.

- MIGRATION (falls out of the schema fork): existing members each have
  one date-based WorkShift. Small dev DB, so simplest is to derive
  dayOfWeek from the old shift's date, seed those hours Mon-Fri with
  weekends isOff, then drop the old date-based records. Wipe-and-re-enter
  is also acceptable given how little data there is. Make it a deliberate
  call in the script, don't let it guess.

### Breaks stay separate from recurring shifts
- Confirmed: breaks can't be recurring (a break is "something happening
  today," not a pattern), so they stay as dated, one-off WorkShift records
  even after standing shifts move to day-of-week recurrence
- Practical effect: ScheduleGrid will need to resolve TWO things per
  member per day - "today's recurring shift" and "today's break(s), if
  any" - and combine them, instead of finding one shift and stopping

### Live Availability Sidebar: 4-state status, not binary
- PRD calls for Active / Away / Do Not Disturb / Offline
- IN PROGRESS (started 7/18): TeamMember.isAvailable Boolean is being
  replaced with a status enum ('active' | 'away' | 'dnd' | 'offline'),
  default 'active'. Manual picker only offers active/away/dnd.
- OFFLINE IS DERIVED, NOT MANUAL: a member shows offline automatically
  when they are not on shift at their own current local time. It is
  computed per-member from that member's own schedule + own local clock,
  independent of who is viewing. So the manual picker deliberately omits
  offline. This "on shift right now" check is deferred to #1 below -
  see the note there - because it needs reliable current-shift
  resolution, which getCurrentShiftForMember does not yet provide.
- The combined model (derived offline overrides stored manual when off
  shift; on shift shows stored status, default active) is the goal;
  we're building the manual layer now and the derived-offline layer with #1.
- Status editing identity: the picker's "can I edit this?" check is wired
  to real auth (AuthContext.teamMemberId), NOT the vestigial viewerId
  dropdown. Backend already enforces this via the JWT. This resolves half
  of the "two sources of who am I" tech-debt item in one pass.

### Meeting Overlap Finder: component shape + access — IMPLEMENTED, see COMPLETED above
- No new context needed - the shared timezone/shift-lookup logic already
  lives in scheduleTime.ts as plain functions, callable from anywhere
- Selection state (which members are checked) lives in ScheduleView.tsx
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

Everything previously listed here (scheduleTime tests, the recurring
day-of-week rework phases 1-8, and the 4-state status layer) is DONE as of
7/24 - see the COMPLETED entries at the top for what landed and why.

1. Break logging UI - now unblocked. This is the first feature that needs
   getCurrentShiftForMember to resolve TWO things per member per day
   (today's standing RecurringShift + any dated WorkShift breaks layered on
   top) instead of one, so it reopens the function every consumer depends
   on - ScheduleGrid, TeamHoursPanel, the overlap row, and now
   getScheduleState/derived status too. Worth a fresh session.
   Open design questions to settle first:
   - Does an active break make someone show 'away' automatically, or is a
     break purely a grid visual? (Compare the derived-offline precedence
     already established - a break is arguably the same kind of hard fact.)
   - How does a break render on a row that already has a standing shift -
     a different cell color inside the shift block, or a separate row?
   - Who can log a break for whom (self-service like hours, or admin too)?

2. Retire the viewerId "Simulating Active User" dropdown - see KNOWN ISSUES
   below. Now the only remaining piece of pre-auth simulation code.

3. Design pass - see KNOWN ISSUES below.

## KNOWN ISSUES / TECH DEBT (canonical list - README points here)

- TeamStatusSidebar's "Simulating Active User" dropdown (TeamContext.
  viewerId) is leftover pre-auth code. PARTIALLY reconciled (7/18): status
  editing now keys off real auth (AuthContext.teamMemberId), but viewerId
  still drives which timezone the grid renders in. Fully retiring the
  dropdown (or pointing the tz preview at real auth) is still outstanding.
- ScheduleGrid (via getCurrentShiftForMember) resolves exactly one STANDING
  shift per member (today's dayOfWeek RecurringShift). This is now correct for
  standing hours, but layering a same-day break on top is still not handled -
  that arrives with the break-logging UI (#2). getCurrentShiftForMember is the
  single place that stitch will happen.
- SHIFT TIMES ARE ONLY VALIDATED CLIENT-SIDE (noticed 7/24). ScheduleGrid
  renders whole-hour blocks, so shifts must start/end on the hour and run
  at least an hour - but that rule lives only in HoursEditor's handleSave.
  PUT /api/team-members/:id/hours checks only that working days HAVE a
  startTime and endTime, not their shape. Anything hitting the API directly
  can store 09:30 and the grid will silently misrender it. The backend
  should enforce the same three rules (start<end, on-the-hour, >=60min);
  low urgency while the only client is our own form, but it's a real gap.
- FirstRunHoursGate dismissal is in-memory only, so it returns on every
  reload until hours are actually set. Deliberate (non-blocking, not
  "seen once, gone forever"), but revisit if it turns out to be annoying
  in daily use - a persisted flag would be the fix.
- AddTeamMemberForm inputs use bg-zinc-800 on a bg-zinc-800 card - relies
  on border alone for separation. Deferred to design pass.
- Broader design pass (button colors, card polish) - explicitly deferred,
  not yet started.

## PRODUCTION DEPLOYMENT CHECKLIST (not started, revisit before going live)
- syncIndexes() is dev-only by design - before deploying, manually audit
  indexes (Compass or a real migration) instead of relying on this running
  automatically
- Test coverage roadmap (scheduleTime.ts pure-function tests DONE 7/20;
  the rest still planned, own workstream):
  - Backend unit tests (Jest) for auth logic - password hashing, JWT
    verification, role-gated middleware (highest-risk code in the project)
  - Integration tests for API routes (team-members, work-shifts, auth)
    via Supertest
  - Frontend component tests (Vitest + React Testing Library) for
    ScheduleGrid's timezone conversion - complex and easy to silently
    break (see the 09:00-09:05 shift bug caught in manual QA)
  - Not planned at this scope: E2E (Playwright/Cypress) - reasonable next
    step only if this grows past a portfolio project
- Audit .env / secrets handling for production config (JWT_SECRET
  rotation, MONGODB_URI, CORS origin currently hardcoded to
  localhost:5173)

## KNOWN GAPS VS README (not started)
- No WebSocket/Socket.io real-time sync (refetches after each action)