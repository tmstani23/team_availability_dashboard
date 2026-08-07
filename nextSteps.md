# Next Steps

Last updated: 2026-08-07

## START HERE NEXT SESSION
Phases 0-3 are committed and browser-verified. Chunk 1 of the 8/3 order (this
file's split + the sidebar timezone label) is done and tested 8/7 - see
`docs/decisions.md`.

THE ROADMAP'S FEATURE WORK IS DONE. What's left is polish and shipping. Two
chunks remain of the three agreed 8/3:

1. DESIGN PASS -> RETIRE viewerId -> FINAL TESTING, in that order and for the
   reasons under AFTER below.
   GOOD FRESH-SESSION BOUNDARY, and the one remaining piece with real
   architectural risk - viewerId currently owns the grid's only timezone
   source, so this is a replacement, not a deletion. Worth a higher model.
   This is where the "Simulating Active User" dropdown becomes a static
   identity block showing the LOGGED-IN user's name, clock and timezone
   (step 2d of the plan). Reuse `formatTimezoneLabel` from scheduleTime.ts -
   it already ships and the sidebar roster rows already read that way, so the
   identity block is a matter of calling it, not designing a format.
   Consequence, accepted deliberately: once the dropdown is gone, checking
   cross-timezone behaviour means logging in as that member in a second
   browser profile. That's the endstate anyway - a picker implying you can
   act as someone else is what auth has forbidden since 7/18 - and it's how
   Phase 1 was QA'd, so the muscle exists.
   OPEN QUESTION for that step: the identity block falls back to the
   browser's zone when the member's stored zone is missing. Decide what it
   should show when the two DISAGREE - a stale stored zone (they moved,
   nobody updated the record) means the grid silently renders in a zone the
   viewer isn't actually in.
2. DEPLOY to Render + Atlas. Research is in `docs/decisions.md`; possible any
   time since Phase 0. Deliberately AFTER (1), since deploy is when a real
   second person gets involved and the identity block should be honest by
   then.

QA status as of 8/3 - Phase 3, all by hand: meeting drawing + "In a meeting"
pill, the same meeting moving 17:00 (Chicago) -> 07:00 (Tokyo) on a viewer
switch and landing on Tokyo's next calendar day, the overlap row excluding
both a lunch hour and a booked hour, a meeting nested inside a full-hour lunch
still drawing, delete refreshing the grid, and cross-session status sync
holding up in a second incognito profile. Lint clean, Vitest green.

QA status as of 8/2 (Phases 0-2) - login and session restore, status set +
persist, overnight shifts (20:00-05:00 saving and drawing continuously through
midnight), lunches rendering as fractional carve-outs with correct tick
spacing, derived "At lunch"/"Offline" statuses, and the admin hours editor's
timezone panel against a Sydney member from Chicago (+15h, cross-date warning
firing correctly).

NOT COVERED BY ANY QA SO FAR, worth a look sometime: a non-admin trying to
delete someone else's meeting (should get the organizer-or-admin message, not
a row that vanishes and reappears), and a meeting booked across the viewer's
local midnight (should draw only the part falling on today).

Still deliberately NOT done: component or backend test coverage. The three
bugs found on 8/2 (status rollback writing undefined, the hours-editor fetch
race, the state bleed between members) all lived in the seam between React
state and the network, which is exactly what the pure-function tests
structurally cannot reach. Phase 3 added more of that seam - MeetingPanel's
form, the create/delete round trips - so this got slightly more valuable.
Tracked in the test roadmap below.

## WHERE THE HISTORY WENT

Completed work and the reasoning behind it now live in `docs/decisions.md` -
every `## COMPLETED` entry and every `### DECISION:` block, moved verbatim on
8/7. This file is now only what's NEXT: start-here, roadmap, known issues,
deployment checklist.

Go read that file before changing anything non-obvious. A lot of what looks
like an arbitrary choice in this codebase is a decision someone already argued
through - the instant-vs-wall-clock split for meetings, why `break` and
`meeting` are absent from the schema enum, why polling beat sockets, why the
stored status default is `away`. New entries get appended there, not here.

## NEXT STEPS (priority order)

Phases 1-3 (polling + heartbeat, recurring lunch, meetings) and the Phase 3
addon (the sidebar timezone label) are all DONE. Their briefs are in
docs/phases/ and what actually landed is in `docs/decisions.md` - the
at-a-glance summaries that used to sit here were describing finished work.

What remains is below, in order.

### 1 — DESIGN PASS, then RETIRE viewerId, then final testing

Sequenced that way deliberately - see the plan below. Both were previously
listed as separate loose items; they're coupled.

Step 1 - design pass (button colors, card polish, the bg-zinc-800-on-
bg-zinc-800 input issue in AddTeamMemberForm, see KNOWN ISSUES). Do this
FIRST because it's the last point where moving UI around is cheap, and the
sidebar is one of the things being touched.

Step 2 - retire the "Simulating Active User" dropdown. This is not just
deleting a <select>: viewerId currently drives WHICH TIMEZONE THE WHOLE
GRID RENDERS IN (TeamContext.viewerTimezone -> ScheduleGrid's conversion).
Removing the control without replacing that source leaves the grid with no
timezone at all. The plan:
  a. Point viewerTimezone at real auth instead - resolve the logged-in
     member via AuthContext.teamMemberId, use THEIR stored timezone, and
     fall back to the browser's zone (dayjs.tz.guess()) if that member
     isn't loaded yet or has no zone set. The fallback matters: the grid
     must always have a zone to convert into.
  b. Delete viewerId / setViewer / viewerMember from TeamContext and
     TeamContextType, and the <select> from TeamStatusSidebar.
  c. Sweep for remaining readers - `viewerTimezone` is used by
     ScheduleGrid and TeamHoursPanel and should keep working untouched if
     (a) is done properly. That's the test: if those two files need edits,
     the replacement isn't clean.
  d. REPLACE the dropdown with a small profile block in the same spot: an
     avatar/initials icon, the logged-in member's name, their current local
     time, and their timezone. Not just a deletion - that corner of the
     sidebar currently answers "whose clock is this grid in?", and the grid
     stays timezone-converted after the dropdown goes, so the question
     outlives the control. A static identity block answers it honestly
     where a picker implied you could change it.
     Reuse `formatTimezoneLabel` from scheduleTime.ts (shipped 8/7 for the
     roster rows), and read the clock from TeamContext's ticking `now`
     rather than dayjs() at render, so it stays live (same reasoning as
     HoursEditor). TeamStatusSidebar's getLocalTime already does both and
     is the shape to copy.
Once presence is real (Phase 1) and meetings exist (Phase 3), "simulating"
another user is actively misleading rather than merely vestigial - it
implies you can act as them, which auth has correctly forbidden since 7/18.

Step 3 - final testing pass, AFTER both of the above. Doing it earlier
means testing a UI that's about to change and a timezone source that's
about to be replaced.

### 2 — DEPLOY to Render + Atlas

See the deployment research in `docs/decisions.md`. Could happen any time
after Phase 0; deliberately after (1) so the identity block is honest before
a second real person sees it.

## KNOWN ISSUES / TECH DEBT (canonical list - README points here)

- TeamStatusSidebar's "Simulating Active User" dropdown (TeamContext.
  viewerId) is leftover pre-auth code. PARTIALLY reconciled (7/18): status
  editing now keys off real auth (AuthContext.teamMemberId), but viewerId
  still drives which timezone the grid renders in. Fully retiring the
  dropdown (or pointing the tz preview at real auth) is still outstanding.
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
  - Integration tests for API routes (team-members, recurring-shifts,
    auth) via Supertest. NOT work-shifts - those routes are deleted in
    Phase 2.
  - Frontend component tests (Vitest + React Testing Library) for
    ScheduleGrid's timezone conversion - complex and easy to silently
    break (see the 09:00-09:05 shift bug caught in manual QA)
  - Not planned at this scope: E2E (Playwright/Cypress) - reasonable next
    step only if this grows past a portfolio project
- Audit .env / secrets handling for production config (JWT_SECRET
  rotation, MONGODB_URI, CORS origin currently hardcoded to
  localhost:5173)

## KNOWN GAPS VS README (not started)
- No live sync of any kind yet. Socket.io was the README's planned answer;
  as of 7/25 the plan is polling + heartbeat instead (Phase 1) - see the
  decisions section at the top for why, including why polling can still
  deliver real "is this person actually here" presence. README updated to
  match.