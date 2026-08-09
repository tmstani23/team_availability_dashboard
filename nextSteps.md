# Next Steps

Last updated: 2026-08-08

## START HERE NEXT SESSION

THE ROADMAP IS DOWN TO DEPLOY. Items 1-3 (12-hour clock, timezone preview,
responsive/mobile) all landed 8/8 and are browser-verified - see
`docs/decisions.md`. So is the select rework and the `wallClockToInstant`
extraction. Lint is clean for the first time since the 8/7 design pass.

What's left, in no forced order:

1. DEPLOY to Render + Atlas. The only remaining item from the original
   roadmap. Research is in `docs/decisions.md`; possible any time since Phase
   0. Left last because deploy is when a real second person gets involved.
2. SCHEDULE IDENTITY IS SELF-OWNED - design settled, not built. See the
   DECISION block below. Moves timezone editing out of admin-only and into
   `/profile/hours`, which is what lets the sidebar's mismatch hint become a
   link instead of a shrug. Touches auth boundaries and probably a route
   rename, so give it its own session and a higher model.
3. JSDOM + REACT TESTING LIBRARY - design settled, not built. See the DECISION
   block below. Four tests, not coverage. Mostly config wiring once the
   thinking is read, so a lower model is fine.

(2) and (3) are independent of each other and of deploy. (3) is the one that
protects work already done: nothing currently stops a refactor from swapping
`viewerTimezone` for `displayTimezone` in MeetingPanel, and every one of the
130 tests would still pass while meetings booked in the wrong zone.

QA STATUS 8/8 (Tim, browser): 12-hour labels throughout; the grid reachable and
scrollable at narrow widths with the name column pinned; sidebar stacking; the
hours editor aligned and not overflowing. The preview was tested against the
split end to end - previewing Tokyo from Chicago, a meeting booked at "8:00 PM"
listed as 8:00 PM (viewer's clock), drew at 10AM on the Tokyo grid, and moved
to 8PM on switching back. `npm run test:run` green (130), lint clean.

STILL NOT COVERED BY QA, carried forward: a non-admin trying to delete someone
else's meeting (should get the organizer-or-admin message, not a row that
vanishes and reappears), and a meeting booked across the viewer's local
midnight (should draw only the part falling on today). New on 8/8: the
base-select popup styling has only been seen in Chromium - the `@supports`
fallback path (Firefox, Safari) is reasoned about but unverified.

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

Still NOT done: component or backend test coverage. The three bugs found on 8/2
(status rollback writing undefined, the hours-editor fetch race, the state
bleed between members) all lived in the seam between React state and the
network, which is exactly what the pure-function tests structurally cannot
reach. No longer "deliberately" - as of 8/8 it has a plan and a scope, see
`### DECISION: add jsdom + React Testing Library`.

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

Phases 1-3 (polling + heartbeat, recurring lunch, meetings), the Phase 3 addon
(the sidebar timezone label), and roadmap items 1-3 (12-hour clock, timezone
preview, responsive) are all DONE. Phase briefs are in docs/phases/ and what
actually landed is in `docs/decisions.md` - the at-a-glance summaries that used
to sit here were describing finished work.

Two DECISION blocks below are DESIGN ONLY - settled, not built. They live here
rather than in `docs/decisions.md` because they're inputs to work that hasn't
happened yet; they move across with the COMPLETED entry they produce. The
timezone-preview block that used to sit here made exactly that trip on 8/8.

What remains is below.

### DECISION: add jsdom + React Testing Library (8/8, design only)

The test roadmap at the bottom of this file has listed frontend component tests
as "planned" since 7/20. This is the argument for actually doing it, and the
scope when someone does.

THE CASE, and it's already written down: every bug this project has found in QA
lived in the seam between React state and the network - the status rollback
writing `undefined`, the hours-editor fetch race, the state bleed between
members (all 8/2). Pure-function tests structurally cannot reach that seam.
The suite is 130 green tests that would not have caught a single one of them.

THE SHARPER REASON, new on 8/8: the timezone preview introduced a DISPLAY /
WRITE split (see the preview DECISION above). `wallClockToInstant` is now
tested and pins that the same wall clock in two zones yields two different
instants - but no test can assert that MeetingPanel passes `viewerTimezone`
rather than `displayTimezone`. That is a CALL-SITE invariant. Someone
refactoring for consistency swaps one identifier, all 130 tests still pass, and
every meeting starts booking in the previewed zone. The invariant this session
was built around is the one thing the current suite cannot hold.

SCOPE, deliberately four tests rather than coverage:
  1. MeetingPanel books in the viewer's zone while a preview is active
     (previewTimezone Tokyo + viewerTimezone Chicago, submit 2PM, assert
     createMeeting got 19:00:00.000Z). The one that matters.
  2. ScheduleGrid DOES follow the preview - the other half, so the split is
     pinned from both sides.
  3. TimeSelect round-trip: hour + minute emit "08:30"; granularity="hour"
     can never emit a non-:00 minute.
  4. Status optimistic rollback: a failed PATCH restores the previous status.
     The exact 8/2 bug.

COST: jsdom, @testing-library/react, @testing-library/user-event,
@testing-library/jest-dom, plus `environment: 'jsdom'` and a setup file in the
Vite config. The real work isn't the tests - it's a `renderWithProviders`
helper, since all four components read useTeam()/useAuth() and need a fake
context injected. One small reusable file.

WHAT IT DOESN'T BUY, so nobody expects it to: jsdom has no rendering engine, so
layout, the sticky column and the base-select popup stay manual. The DevTools
Sensors timezone QA also stays manual and MUST - `renderWithProviders` injects
a fake context, so it deliberately bypasses BROWSER_TIMEZONE and the whole
fallback chain, which is exactly the path Sensors exercises.

NOTE for whoever writes them: query by role and accessible name, never by
markup structure - component tests are the ones that rot. ThemedSelect and
TimeSelect were given aria-labels on 8/8 partly for this.

ALSO NOTE: `BROWSER_TIMEZONE` is read once at module load in TeamContext, so
unit-testing the fallback chain directly needs the TZ env var set before the
process starts, not per-test. Fine for the four above; a trap for anyone going
further without refactoring that constant first.

### DECISION: schedule identity is self-owned (8/8, design only)

Raised while asking a blunter question: why does `/profile/hours` exist at all
if an admin can already edit anyone's hours? Isn't one of them redundant?

They're not - admin-edit covers onboarding someone who has never logged in
(unset hours are the whole reason FirstRunHoursGate exists) and fixing someone
who's unreachable. One `HoursEditor` with a `mode: 'self' | 'admin'` flag
serves both against one self-or-admin route, so there's no duplicated
implementation either.

But the question exposed something real. The THREE fields that all answer
"when am I available" have three different permission rules, and no principle
connecting them:

  - `status`   - self only. An admin cannot set yours.
  - `hours`    - self OR admin.
  - `timezone` - ADMIN ONLY. There is no self-service editor at all.

Nobody chose that spread; it accumulated. Timezone ended up admin-only because
it arrived as part of the member PROFILE (name / role / timezone on
TeamMemberCard), not because anyone decided a person shouldn't own their own
zone - and it's the one with the worst consequence, since a stale timezone
misreports someone to the entire team until an admin notices.

THE PRINCIPLE, proposed: schedule identity is SELF-OWNED, and admin is an
OVERRIDE for onboarding and absence. Status already follows it. Hours already
follow it. Timezone is the outlier, and moving it into `/profile/hours` is what
makes the rule true rather than mostly-true.

WHAT THIS UNBLOCKS, and the reason it's worth doing rather than just tidy: the
sidebar's timezone-mismatch hint currently NAMES the disagreement instead of
offering a fix ("ask an admin to update it if that is wrong"), and the existing
known-issues entry says outright that the hint should become a link if
self-service is ever added. It can't link anywhere today because there is
nothing to link to. So this is the missing half of a feature that already
shipped, not a new one.

REJECTED, deleting `/profile/hours` instead: it collapses the permission
question the wrong way. Making hours admin-only to match timezone means a
member can't correct their own schedule, which is the opposite of where status
already landed, and it would make FirstRunHoursGate incoherent - a gate
prompting you to set hours you aren't allowed to set.

OPEN, for whoever builds it:
  - Does the admin's TeamMemberCard KEEP its timezone field, or lose it? Keep
    is the safer default (onboarding still needs it), but then two surfaces
    write one field and they have to agree.
  - `/profile/hours` is named for hours. Adding timezone makes it a profile
    page wearing an hours name - worth deciding whether it becomes
    `/profile`, with hours as one section.
  - Changing your own timezone RETIMES you for the whole team, unlike changing
    your own status. That asymmetry probably deserves a confirmation step or
    at least a plain warning, which status never needed.

SESSION NOTE: this touches auth boundaries and a route rename, so it wants its
own session rather than riding along with UI polish.

### 4 — DEPLOY to Render + Atlas

See the deployment research in `docs/decisions.md`. Could happen any time
after Phase 0; deliberately last, since deploy is when a real second person
gets involved.

## KNOWN ISSUES / TECH DEBT (canonical list - README points here)

- There is NO self-service timezone editor. `TeamMember.timezone` is only
  editable by an admin, via TeamMemberCard on `/admin/manage`; `/profile/hours`
  doesn't touch it. This is why the identity block's mismatch hint NAMES the
  disagreement rather than linking to a fix (see `docs/decisions.md`, 8/7).
  NOW HAS A PLAN, 8/8: see `### DECISION: schedule identity is self-owned`
  above. Fixing it is what turns that hint into a link.
- A timezone PREVIEW draws meetings from a fetch it doesn't control. The
  meetings request is scoped to the VIEWER's local day (deliberately - a
  display control must not change what the app requests), but ScheduleGrid
  clamps drawing to the DISPLAY zone's day. So previewing a distant zone can
  drop a meeting sitting at the edge of your own day. Commented at the call
  site. Accepted rather than fixed, because the fix couples the two halves of
  the split back together.
- The `base-select` popup styling is CHROMIUM-ONLY so far. It's behind
  `@supports`, so Firefox and Safari fall back to the native popup, but that
  fallback has been reasoned about and not looked at. Worth ten minutes in
  Firefox before showing this to anyone.
- Shift start/end are HOUR-ONLY, breaks are quarter-hour. That's enforced in
  three places now (`shiftValidation.ts`, HoursEditor's `handleSave`, and
  `TimeSelect`'s `granularity` prop) and the reason is real - ScheduleGrid
  lights whole hour cells, so a fractional shift boundary has nothing to
  half-light. Not debt exactly, but three enforcement points for one rule is
  worth knowing about before changing any of them.
- `BROWSER_TIMEZONE` is read once at module load, so someone who changes their
  OS timezone with the tab open sees a stale grid until they reload. Accepted:
  the alternative is re-deriving per render for an answer that essentially
  never changes. Worth revisiting only if it bites during QA.
- FirstRunHoursGate dismissal is in-memory only, so it returns on every
  reload until hours are actually set. Deliberate (non-blocking, not
  "seen once, gone forever"), but revisit if it turns out to be annoying
  in daily use - a persisted flag would be the fix.
- Meeting carve-outs are distinguished from LUNCHES by COLOUR ALONE.
  Rose-on-sage survives red-green colour blindness, but the accessible answer
  is a second, non-colour signal.
  CORRECTED 8/7 - this entry used to say "the lunch carve already has its
  quarter-hour ticks; meetings have nothing," which is wrong and would send
  someone looking for tick code that already exists. `TICKS` in ScheduleCell
  is drawn on ANY cell containing a carve, lunch or meeting alike. So the
  ticks are a shared RULER, not a differentiator - which is exactly why the
  problem stands: the two carve types render identically apart from hue.
  Left out of the 8/7 design pass deliberately rather than half-built: it
  means changing ScheduleCell's slice layering, which produced two subtle
  bugs in Phase 3 and deserves its own decision rather than a drive-by.
- Text colours are tokenised (`ink` / `ink-muted` / `ink-faint`) but the
  TYPE SCALE isn't - heading sizes are still per-component `text-2xl` /
  `text-xl` / `text-lg` picked by feel. Worth a `--text-*` set if a fourth
  heading size ever shows up.
- ScheduleGrid still hardcodes its column maths (120px name column, 55px
  per hour, 2px gap) as inline styles rather than tokens. Left alone on
  purpose: the overlap row depends on being pixel-aligned with the member
  rows, and that alignment is the thing most likely to break silently.

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
  - Frontend component tests (Vitest + React Testing Library) - SCOPED 8/8,
    see `### DECISION: add jsdom + React Testing Library` above for the four
    tests and the setup cost. ScheduleGrid's timezone conversion is one of
    them; the display/write split is the one that matters most.
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