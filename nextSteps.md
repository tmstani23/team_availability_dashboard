# Next Steps

Last updated: 2026-08-24

## START HERE NEXT SESSION

Deploy prep landed 8/24 (in `docs/decisions.md`), and took the seedAdmin
blocker with it. ONE ROADMAP ITEM LEFT, and it is now purely the hosting half:

1. DEPLOY to Render + Atlas. Everything that had to be true before a host sees
   this repo now is: `backend/` has `build` and `start`, Express serves
   `frontend/dist` from the same origin with an Express 5 catch-all, the auth
   cookie goes `secure` under `NODE_ENV=production`, `VITE_API_URL` can no
   longer silently ship a localhost bundle, and `seedAdmin.ts` exists and has
   been run against a genuinely empty database. What's left is account work:
   create the Atlas cluster, allowlist your IP, run `seedAdmin.ts` with
   `MONGODB_URI` pointed at it, then create the Render service.

Three things to carry into that session, all learned 8/24:

- Use a DIFFERENT `JWT_SECRET` on Render than locally. Sessions are bound to
  the secret, so the same one across environments means a token minted against
  one database authenticates against the other. That is not theoretical - it
  happened during QA and produced a phantom admin view.
- Render's build command wants `npm ci --include=dev && npm run build`. If you
  set `NODE_ENV=production` as an env var there (and you must, for the cookie
  and the static serving), npm skips devDependencies at install time and `tsc`
  won't exist when the build runs.
- Delete `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from Render's env once the
  script has run. Nothing reads them at runtime.

The test ladder from the original research is still worth walking, and only its
first rung is done: two browser profiles (done, repeatedly, 8/24) -> LAN via
`vite --host` from a phone -> cloudflared tunnel for a second real person ->
deploy. Note the two-profile rung cannot test differing VIEWER timezones, since
both browsers read the same OS clock.

CLOSED 8/24: the seedAdmin blocker, and its DECISION block moved to
`docs/decisions.md` next to the entry it produced. Also closed, none of it
planned: `authenticate` now revokes properly, a promoted member can reach the
admin area without re-logging, the last admin can't be deleted, and a dead
session logs the tab out instead of emptying it. See the 8/24 entry.

QA STATUS 8/24 (Tim, browser + devtools): existing behaviour unaffected across
two profiles; `seedAdmin.ts` against an empty database including the duplicate
refusal and the UTC fallback; login as the seeded admin on a one-member
database; database-swap eviction; promotion without re-login; deletion of a
logged-in member rerouting them to login and refusing a re-login; the
member-hits-admin-route loop check; last-admin delete refused with its wording
visible on the card. Tests green on both halves, lint clean.

STILL NOT COVERED, carried forward: a non-admin trying to delete someone else's
meeting (should get the organizer-or-admin message, not a row that vanishes and
reappears - note `deleteMember` got exactly this treatment on 8/24, so the
shape to copy now exists in two places), and a meeting booked across the
viewer's local midnight (should draw only the part falling on today). From 8/8:
the `base-select` popup styling has only been seen in Chromium - the `@supports`
fallback path (Firefox, Safari) is reasoned about but unverified. New on 8/24:
`seedAdmin.ts`'s invalid-timezone refusal and its missing-required-var bail have
never been run.

Test coverage as of 8/24: unchanged from 8/23 in scope - pure functions on both
halves plus four component areas on the frontend, 151 total - but the risk
profile moved. NOTHING from 8/24 has an automated test, and that includes
`authenticate`, which is the highest-risk code in the project and now has a
database lookup and a third failure mode in it. Still blocked on the same
`bcrypt` import chain. See the roadmap at the bottom of this file.

## WHERE THE HISTORY WENT

Completed work and the reasoning behind it now live in `docs/decisions.md` -
every `## COMPLETED` entry and every `### DECISION:` block, moved verbatim on
8/7. This file is now only what's NEXT: start-here, roadmap, known issues,
deployment checklist.

Go read that file before changing anything non-obvious. A lot of what looks
like an arbitrary choice in this codebase is a decision someone already argued
through - the instant-vs-wall-clock split for meetings, why `break` and
`meeting` are absent from the schema enum, why polling beat sockets, why the
stored status default is `away`, and now why `authenticate` pays for a database
lookup on every request. New entries get appended there, not here.

## NEXT STEPS (priority order)

Phases 1-3 (polling + heartbeat, recurring lunch, meetings), the Phase 3 addon
(the sidebar timezone label), and roadmap items 1-3 (12-hour clock, timezone
preview, responsive) are all DONE. Phase briefs are in docs/phases/ and what
actually landed is in `docs/decisions.md` - the at-a-glance summaries that used
to sit here were describing finished work.

No DESIGN-ONLY blocks are left here. The seedAdmin block made the trip across
to `docs/decisions.md` on 8/24 with the COMPLETED entry it produced, the same
way the jsdom + RTL block did on 8/17, the timezone-preview block on 8/8 and
the backend-validation block on 8/12. Anything new that needs designing before
it's built gets written here first and moves the same way.

What remains is below.

### 4 — DEPLOY to Render + Atlas

Full research in `docs/decisions.md` ("Deployment research (7/25)"), and the
code half is done as of 8/24 - see that entry for what each piece does and why.
The essentials that still matter:

- Render = PaaS running Express (git-push deploy, free tier, HTTPS
  terminated for you, spins down after 15 min idle / ~1 min cold start).
  Atlas = managed Mongo, free tier 512MB and permanent. Swap `MONGODB_URI`.
- ONE service, not two, and the reason is the cookie, not convenience. Built
  and in `server.ts` now.
- `NODE_ENV=production` switches FOUR things, not one: it skips the dev-only
  `syncIndexes()`, trusts one proxy hop for `X-Forwarded-*`, puts `secure` on
  the auth cookie, and serves `frontend/dist`. Getting it wrong is quiet -
  the symptom is a plain-text "Backend is running" at `/`.
- Build both halves. The frontend build has to run too, and its output is what
  Express serves. See the build-command note in START HERE.
- Still not done: anything requiring an account. Atlas cluster, IP allowlist,
  Render service, env vars, and the first `seedAdmin.ts` run against Atlas.

## KNOWN ISSUES / TECH DEBT (canonical list - README points here)

- AUTH STATE IN THE CLIENT IS A MOUNT-TIME SNAPSHOT. `AuthContext` asks
  `/api/auth/me` once, in a mount effect, so a role change mid-session doesn't
  reach an open tab until it reloads. PROMOTION is handled - `/dashboard`
  redirects an admin to `/admin/schedule` as of 8/24 - but DEMOTION is not: a
  demoted admin keeps a Manage tab that now only yields 403s. Harmless, since
  the server stopped believing the token on 8/24, and it under-grants rather
  than over-grants. The clean fix is NOT polling `/auth/me` (a fourth request
  every 15s for something that changes about twice a year) but having one of
  the three responses already polled carry the caller's current role, so
  `AuthContext` can update from data in flight. That's a response-shape change
  and a context-seam change, so it wants its own session.
- A 401 ON A ONE-OFF ACTION STILL FAILS IN PLACE. The POLL evicts a dead
  session properly as of 8/24, but setting a status or booking a meeting
  against a dead session just shows whatever error that call shows today. The
  poll catches it within 15 seconds regardless, so the gap is one interval, not
  indefinite. A shared fetch wrapper is the real answer if this ever grows.
- AUTH NOW DEPENDS ON MONGO BEING REACHABLE. `authenticate` was pure CPU and
  now does a badge lookup, so a database outage becomes a login outage rather
  than only a data outage. Deliberate - it's the price of revocation working -
  and the failed-lookup path answers 500 rather than 401 specifically so a blip
  can't masquerade as an expiry and log everyone out. Worth knowing before
  reading a confusing incident.
- TIMEZONE NOW HAS THREE WRITING SURFACES: the member's own `/profile`, the
  admin's TeamMemberCard, and `seedAdmin.ts`. The first two were accepted
  deliberately on 8/11 rather than collapsed - the admin path is the override
  for onboarding someone who has never logged in - and the script joined them
  on 8/24. All three now validate the same way (`Intl.DateTimeFormat` in a
  try/catch), but that is three places to change if the rule ever moves, and
  the script found out the hard way what happens when one of them doesn't.
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

## PRODUCTION DEPLOYMENT CHECKLIST (revisit before going live)
- syncIndexes() is dev-only by design - before deploying, manually audit
  indexes (Compass or a real migration) instead of relying on this running
  automatically
- Test coverage roadmap (frontend `scheduleTime.ts` pure-function tests DONE
  7/20; backend validation tests DONE 8/12; frontend component tests DONE
  8/17; the rest still planned, own workstream):
  - Backend unit tests for auth logic - password hashing, JWT verification,
    role-gated middleware (highest-risk code in the project, and MORE so since
    8/24: `authenticate` now performs a badge lookup and has three distinct
    failure modes, none of them pinned). Vitest now exists in `backend/`, so
    this no longer needs a runner decision - but it DOES need the `bcrypt`
    import chain solved, since native bindings can't load in Claude's Linux
    sandbox against Windows-installed `node_modules`. See the 8/12 DECISION in
    `docs/decisions.md`.
  - Integration tests for API routes (team-members, recurring-shifts,
    auth) via Supertest. NOT work-shifts - those routes are deleted in
    Phase 2. Prerequisites, none of them done: splitting `app.ts` out of
    `server.ts` so the app can be imported without starting a server or
    connecting to Mongo, the bcrypt problem above, and a decision on whether
    to mock Mongoose or run a real test database. This is what would cover
    the self-or-admin 403 permanently rather than by devtools fetch - and now
    also the last-admin guards on both `PATCH /:id/role` and `DELETE /:id`,
    which are a pair that must not drift apart again.
  - Frontend component tests (Vitest + React Testing Library) - DONE 8/17,
    scoped 8/8. Four areas, 12 tests, not coverage; see the COMPLETED entry
    and the DECISION block in `docs/decisions.md`. The display/write split is
    now pinned from both sides, which was the point. `renderWithProviders` in
    `src/test/` is the helper to reuse for a fifth - note it injects a FAKE
    context, so anything testing TeamProvider's own logic has to mount the
    real provider and stub `fetch` the way the status-rollback test does.
  - Not planned at this scope: E2E (Playwright/Cypress) - reasonable next
    step only if this grows past a portfolio project
- Audit .env / secrets handling for production config. `server.ts` reads
  `process.env.CORS_ORIGIN` and only FALLS BACK to localhost:5173; the var is
  in `backend/.env.example` alongside NODE_ENV. Config extraction happened in
  Phase 0. Added 8/24: `JWT_SECRET` must DIFFER between local and Render, and
  the two `SEED_ADMIN_*` vars should be deleted from any host once the script
  has run.

## KNOWN GAPS VS README (not started)
- No live sync of any kind yet. Socket.io was the README's planned answer;
  as of 7/25 the plan is polling + heartbeat instead (Phase 1) - see the
  decisions section at the top for why, including why polling can still
  deliver real "is this person actually here" presence. README updated to
  match.
