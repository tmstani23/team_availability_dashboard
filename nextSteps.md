# Next Steps

Last updated: 2026-08-23

## START HERE NEXT SESSION

The `setStatus` refused-write fix landed 8/23 (in `docs/decisions.md`), and
took the carried-forward permission check with it. ONE ROADMAP ITEM LEFT, and
nothing else outstanding:

1. DEPLOY to Render + Atlas. The only remaining item from the original
   roadmap. Research is in `docs/decisions.md`; possible any time since Phase
   0. Left last because deploy is when a real second person gets involved.
   Note `backend/` has no build script yet - only `dev` and `test` - so
   producing `dist/` is part of this item, not something that already works.
   The FRONTEND does have one (`tsc -b && vite build`), but `VITE_API_URL` is
   baked in at BUILD time and there is no `frontend/.env`, only
   `.env.example` - so a production build with that variable unset silently
   ships a bundle pointing at localhost:5000. That's the first thing to get
   right in this item, not the last.

This is a good fresh-session boundary. Deploy is its own workstream - real
accounts, real secrets, a build script that doesn't exist yet - and none of it
shares context with what came before.

CLOSED 8/23, carried forward since 8/17: the self-or-admin check on
`PATCH /api/team-members/:id/timezone`, both directions, plus the same two on
the status route. Verified by devtools fetch; see the QA paragraph in the 8/23
entry. Worth knowing it's a SNAPSHOT, not a regression test - it goes stale the
moment those routes change, and the permanent answer is still the Supertest
work blocked on `bcrypt`.

QA STATUS 8/23 (Tim, browser + devtools): the self-or-admin gate on both the
status and timezone routes, all four directions - see the 8/23 COMPLETED entry.
Tests green (151), lint clean.

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

Test coverage as of 8/23: pure functions on both halves (frontend 8/8 and
before, backend 8/12) plus four component areas on the frontend (8/17, one
test added 8/23 - 151 total). The React-state/network seam that produced all
three 8/2 bugs is now reachable - the status rollback is pinned from BOTH
failure directions, a thrown fetch and a refused response, and the
display/write split is pinned from both sides. Still NOT covered: route handlers, every auth guard, and
anything asserting a write actually landed. See the roadmap at the bottom of
this file.

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

No DESIGN-ONLY blocks are left here. The jsdom + RTL block made the trip across
to `docs/decisions.md` on 8/17 with the COMPLETED entry it produced, the same
way the timezone-preview block did on 8/8 and the backend-validation block on
8/12. Anything new that needs designing before it's built gets written here
first and moves the same way.

What remains is below.

### 4 — DEPLOY to Render + Atlas

Full research in `docs/decisions.md` ("Deployment research (7/25)"). Could
happen any time after Phase 0; deliberately last, since deploy is when a real
second person gets involved. The essentials:

- Render = PaaS running Express (git-push deploy, free tier, HTTPS
  terminated for you, spins down after 15 min idle / ~1 min cold start).
  Atlas = managed Mongo, free tier 512MB and permanent. Swap `MONGODB_URI`.
- ONE service, not two. Express serves the built frontend (`express.static`
  on `dist/` + a catch-all so client routes return `index.html`). This is
  load-bearing, not convenience: same origin is what keeps the auth cookie's
  `sameSite: 'lax'` working. Splitting the domains forces `'none'` +
  `secure`, which is the third-party-cookie pattern browsers keep clamping
  down on and breaks differently in Safari.
- Not yet built: a backend `build` script and production `start` (only `dev`
  via ts-node-dev and `test` exist), plus the static-serving above.
- `secure: true` on the cookie once behind HTTPS - currently `false` with a
  comment at the call site in `authRoutes.ts`.
- `VITE_API_URL` is baked in at BUILD time and there's no `frontend/.env`.
  Unset at build = a bundle silently pointing at localhost:5000.
- Test ladder before Render, not after: two browser profiles -> LAN via
  `vite --host` from a phone (real network drops) -> cloudflared tunnel for
  a second real person -> deploy.

## KNOWN ISSUES / TECH DEBT (canonical list - README points here)

- TIMEZONE NOW HAS TWO WRITING SURFACES: the member's own `/profile` and the
  admin's TeamMemberCard. Accepted deliberately on 8/11 rather than collapsed -
  the admin path is the override for onboarding someone who has never logged
  in - but it is two forms writing one field, so a change to how a zone is
  validated or presented has to land in both. They share `TIMEZONE_OPTIONS`
  and the same route, which is what keeps them honest.
  (This entry replaces "there is NO self-service timezone editor", which was
  the known issue here until 8/11.)
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
- Test coverage roadmap (frontend `scheduleTime.ts` pure-function tests DONE
  7/20; backend validation tests DONE 8/12; frontend component tests DONE
  8/17; the rest still planned, own workstream):
  - Backend unit tests for auth logic - password hashing, JWT verification,
    role-gated middleware (highest-risk code in the project). Vitest now
    exists in `backend/`, so this no longer needs a runner decision - but it
    DOES need the `bcrypt` import chain solved, since native bindings can't
    load in Claude's Linux sandbox against Windows-installed `node_modules`.
    See the 8/12 DECISION in `docs/decisions.md`.
  - Integration tests for API routes (team-members, recurring-shifts,
    auth) via Supertest. NOT work-shifts - those routes are deleted in
    Phase 2. Prerequisites, none of them done: splitting `app.ts` out of
    `server.ts` so the app can be imported without starting a server or
    connecting to Mongo, the bcrypt problem above, and a decision on whether
    to mock Mongoose or run a real test database. This is what would cover
    the self-or-admin 403 permanently rather than by devtools fetch.
  - Frontend component tests (Vitest + React Testing Library) - DONE 8/17,
    scoped 8/8. Four areas, 12 tests, not coverage; see the COMPLETED entry
    and the DECISION block in `docs/decisions.md`. The display/write split is
    now pinned from both sides, which was the point. `renderWithProviders` in
    `src/test/` is the helper to reuse for a fifth - note it injects a FAKE
    context, so anything testing TeamProvider's own logic has to mount the
    real provider and stub `fetch` the way the status-rollback test does.
  - Not planned at this scope: E2E (Playwright/Cypress) - reasonable next
    step only if this grows past a portfolio project
- Audit .env / secrets handling for production config (JWT_SECRET
  rotation, MONGODB_URI).
  CORRECTED 8/23 - this used to say "CORS origin currently hardcoded to
  localhost:5173", which is stale. `server.ts` reads `process.env.CORS_ORIGIN`
  and only FALLS BACK to localhost:5173; the var is in `backend/.env.example`
  alongside NODE_ENV. Config extraction happened in Phase 0.

## KNOWN GAPS VS README (not started)
- No live sync of any kind yet. Socket.io was the README's planned answer;
  as of 7/25 the plan is polling + heartbeat instead (Phase 1) - see the
  decisions section at the top for why, including why polling can still
  deliver real "is this person actually here" presence. README updated to
  match.