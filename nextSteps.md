# Next Steps

Last updated: 2026-08-07

## START HERE NEXT SESSION
Phases 0-3 are committed and browser-verified. So are the doc split + sidebar
timezone label, the DESIGN PASS, and the viewerId RETIREMENT - all tested 8/7,
see `docs/decisions.md`.

THE ROADMAP'S FEATURE WORK IS DONE, so is the visual system, and so is the
last pre-auth leftover. Everything remaining is polish, one new feature, and
deploy:

1. 12-HOUR CLOCK sweep. START HERE - small, self-contained, and mostly one
   line in ScheduleGrid's column headers (`{hour}:00` -> `formatHourLabel`).
   Ordered first because both (2) and (3) touch the grid, and working against
   final labels beats working against labels about to change.
2. TIMEZONE PREVIEW. A control that previews a ZONE, not a person. The design
   is settled - see `### DECISION: timezone PREVIEW` below, and read it before
   starting; it has a display-zone / write-zone split that isn't optional.
   This replaces what the retired dropdown was genuinely useful for (demoing
   cross-timezone behaviour) without reintroducing impersonation.
3. RESPONSIVE / MOBILE, demo-surface scope. Bigger than it first looked - the
   grid is effectively invisible at narrow widths, so this needs structural
   work and not just breakpoints. Two concrete suspects are already written
   up under the item. The expensive question (what the grid IS on a phone) is
   explicitly deferred.
4. DEPLOY to Render + Atlas. Research is in `docs/decisions.md`; possible any
   time since Phase 0. Deliberately last, since deploy is when a real second
   person gets involved.

NOT BLOCKING, but the next person to touch it will trip over it: `npm run
lint` reports one error in `Button.tsx` - `buttonClasses` exported alongside a
component trips `react-refresh/only-export-components`. Pre-existing from the
8/7 design pass. The fix is moving `buttonClasses` to its own module and
updating call sites.

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

### DECISION: timezone PREVIEW, not user simulation (8/7, design only)

Raised while testing the viewerId retirement: with the dropdown gone, demoing
cross-timezone behaviour needs DevTools, which is fine for QA and useless for
showing the app to a person.

FIRST PROPOSAL, rejected: an admin-only "debug mode" restoring the old
simulate-as-user dropdown. Two problems.
- It would TEST THE WRONG PATH. The old dropdown was load-bearing - it WAS the
  zone source, so QA through it exercised the real thing. A debug override
  SHADOWS the real source, so testing through it would never exercise
  browser-sourcing, the fallback chain, or mismatch detection - precisely the
  new code. It'd give confidence about the debug path while the shipping path
  went unverified.
- "Doesn't change any logic" isn't reachable. `viewerTimezone` feeds four
  consumers: ScheduleGrid, TeamHoursPanel, MeetingPanel's wall-clock ->
  instant conversion, and the meetings FETCH WINDOW. Overriding it overrides
  all four, so debug mode could book a real meeting interpreted through the
  simulated user's zone. Making it view-only means splitting display-zone from
  write-zone, which IS a logic change, in the exact spot this decision block
  called forced.

ANSWER: a control that previews a ZONE, not a PERSON. "Show this grid in
Berlin" implies nothing about identity, so none of the 7/18 impersonation
reasoning applies - that objection was specifically that acting AS someone
implies an authority auth forbids.

Better on several axes at once: no admin gate needed (it isn't privileged -
every member's timezone is already in the GET /team-members response), no
impersonation problem, and it's arguably a real FEATURE rather than debug
scaffolding, since "what does my team's day look like in Berlin before I
schedule this?" is a question a user of an availability dashboard actually
has. It still demos exactly what's wanted: picking Tokyo shows the same grid
the Tokyo employee sees.

THE IRREDUCIBLE COST, either way: display-zone and write-zone must separate.
Sketch - a `previewTimezone` defaulting to null, consulted ONLY by
ScheduleGrid and TeamHoursPanel as `previewTimezone ?? viewerTimezone`.
MeetingPanel and the meetings fetch window keep reading `viewerTimezone`
unconditionally. While a preview is active the grid needs a persistent banner,
and MeetingPanel either disables or states plainly that it books in your real
zone. Without that separation someone previews Tokyo, books "2pm", and it
lands at 2pm Chicago.

OPEN: whether preview should persist across reloads. Leaning no - it's a
transient "let me look at" action, and in-memory sidesteps the persistence
machinery the viewer-timezone DECISION already rejected for the same reason.

### 1 — 12-HOUR CLOCK EVERYWHERE (small, self-contained)

Raised 8/7. ORDERED FIRST because it's cheap and because every later pass
benefits from it landing before they start: (2) adds a zone-preview banner and
(3) reflows the grid, and both are easier against final labels than against
labels that are about to change. "6AM" is also narrower than "6:00", which
buys real horizontal room for the responsive work.

`formatHourLabel` already gives "9AM"/"5PM", but ONLY for the in-cell shift
start/end labels - it is not used for the column headers. The roster/card
clocks use `hh:mm A`. The inventory of what actually still renders 24-hour:

- **ScheduleGrid's column headers**, line ~105: `{hour}:00`, giving
  "6:00 … 23:00" across all 24 columns. The most visible 24-hour surface in
  the app and a one-line fix - `formatHourLabel(hour)` already returns exactly
  the right thing and is already imported in that file.
- **TeamStatusSidebar, the `Working {startTime}–{endTime}` line.** The only
  place raw stored `HH:mm` reaches the screen ("Working 09:00–21:00").
- HoursEditor's two validation strings ("times must be HH:mm (e.g. 09:00)").
  These describe the STORAGE format, so they may be correct as-is - decide
  rather than reflexively changing them.
- Minor, decide while in there: the clocks use `hh:mm A`, which renders
  "02:41 PM" with a leading zero. `h:mm A` gives "2:41 PM". `.tnum` already
  holds the digits fixed-width, so the leading zero isn't buying stability.

DO NOT touch the `<input type="time">` fields in HoursEditor and MeetingPanel.
Those are locale-driven - Chrome on a US machine already draws them 12-hour
with an AM/PM spinner. Forcing the format means replacing them with text
inputs and hand-rolling AM/PM parsing, trading a free picker and free
validation for a new class of bug.

THE TRAP, and the only part with real risk: storage stays 24-hour.
`RecurringShift.startTime` is `HH:mm` and the backend validates that shape, so
a formatted string must never travel back into component state or up to the
API. This is display-only, applied at the render edge.

SHAPE: a `formatWallClock(hhmm)` in `scheduleTime.ts` beside `formatHourLabel`,
with cases added to `scheduleTime.test.ts`. It has to be its own function
rather than reusing `formatHourLabel` because `HourRange` carries no minutes -
which is exactly why the existing formatter can't cover this case.

### 2 — BUILD THE TIMEZONE PREVIEW

Implements the `### DECISION: timezone PREVIEW, not user simulation` block
above - read it first, the shape and the rejected alternatives are all there.

Short version: a `previewTimezone` (default null) consulted ONLY by
ScheduleGrid and TeamHoursPanel as `previewTimezone ?? viewerTimezone`.
MeetingPanel and the meetings fetch window keep reading `viewerTimezone`
unconditionally, so a preview can never reinterpret a write. Banner on the
grid while active.

### 3 — RESPONSIVE / MOBILE, demo-surface scope (8/7)

SCOPE SETTLED UP FRONT: mobile is a DEMO surface, not a use surface. The bar
is "someone opens this on a phone and it doesn't look broken," NOT "people
check availability from their phones daily." That distinction is what keeps
the hard question below deferred and horizontal scroll an acceptable answer.

Sizing, revised 8/7 after seeing it: bigger than the "afternoon of breakpoint
rules" first guessed, since the grid needs structural work (below), but still
short of a full phase - the expensive part is the deferred one.

NOT purely breakpoints - confirmed 8/7 that the grid is effectively INVISIBLE
at narrow widths (member names render, cells can't be found), so this needs
real component reordering, not just stacking rules.

What's actually broken at narrow widths:
- **The grid disappears.** Two suspects, both in ScheduleGrid and both
  independently worth fixing:
    - `mx-auto` on the row grids (`className="grid mx-auto pl-8"`), which are
      ~1440px inside an `overflow-x-auto` container. Auto margins on an item
      wider than its scroll container make part of the overflow UNREACHABLE
      rather than scrollable - a known trap and the likeliest cause.
    - The mount effect's `gridContainer.scrollLeft = 360` ("approximate scroll
      to 8AM"). A magic number tuned to one viewport; on a narrow screen it
      lands mid-grid with no anchor. Should scroll to `now` rather than a
      constant, or be skipped below a width threshold.
- The main/sidebar split never stacks, so both columns stay squeezed. Stacking
  below `lg` is most of the rest.
- Compare Availability pills clip their hour labels ("7AM–3P", "8PM–2A")
  instead of wrapping.
- MeetingPanel's header collides with its "Book a meeting" button.
- The member-name column needs to stay visible while the hours scroll, or the
  grid is unreadable on a phone even once it's findable. Sticky first column
  is the obvious answer and is probably the single highest-value change here.

DELIBERATELY OUT OF SCOPE, and the reason this isn't a full phase: what the
GRID should be on a phone. It's 120px + 55px x 24 = ~1440px minimum, so a
375px screen shows about four hours and "who's free right now" takes swiping -
which is the one question the app exists to answer in under two seconds. Real
answers (a "now +/- 4 hours" window, a per-member list layout, drill-down)
are a design decision with alternatives, and they need their own brief and
DECISION block. Under demo-surface scope, horizontal scroll is fine.

WARNING for whoever picks up the deferred version: it collides head-on with
the hardcoded-column-maths known issue below. Those inline styles were left
alone on purpose because the overlap row depends on being pixel-aligned with
the member rows, and any responsive grid rework has to touch exactly that.

### 4 — DEPLOY to Render + Atlas

See the deployment research in `docs/decisions.md`. Could happen any time
after Phase 0; deliberately last, since deploy is when a real second person
gets involved.

## KNOWN ISSUES / TECH DEBT (canonical list - README points here)

- `npm run lint` reports ONE error, in `Button.tsx`: `buttonClasses` is
  exported alongside a component, which trips
  `react-refresh/only-export-components`. Pre-existing from the 8/7 design
  pass. The fix is moving `buttonClasses` into its own module and updating
  call sites - deliberately not done as a drive-by during the viewerId work.
- There is NO self-service timezone editor. `TeamMember.timezone` is only
  editable by an admin, via TeamMemberCard on `/admin/manage`; `/profile/hours`
  doesn't touch it. This is why the identity block's mismatch hint NAMES the
  disagreement rather than linking to a fix (see `docs/decisions.md`, 8/7). If
  self-service is ever added, that hint should become a link.
- `BROWSER_TIMEZONE` is read once at module load, so someone who changes their
  OS timezone with the tab open sees a stale grid until they reload. Accepted:
  the alternative is re-deriving per render for an answer that essentially
  never changes. Worth revisiting only if it bites during QA.
- FirstRunHoursGate dismissal is in-memory only, so it returns on every
  reload until hours are actually set. Deliberate (non-blocking, not
  "seen once, gone forever"), but revisit if it turns out to be annoying
  in daily use - a persisted flag would be the fix.
- Meeting carve-outs are distinguished from lunches and on-shift blocks by
  COLOUR ALONE. Rose-on-sage survives red-green colour blindness, but the
  accessible answer is a second, non-colour signal (the lunch carve already
  has its quarter-hour ticks; meetings have nothing). Left out of the 8/7
  design pass deliberately rather than half-built: it means changing
  ScheduleCell's slice layering, which produced two subtle bugs in Phase 3
  and deserves its own decision rather than a drive-by.
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