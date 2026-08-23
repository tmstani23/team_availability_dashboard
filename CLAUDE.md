# Project rules for Claude

Canonical source for how to work in this repo: git rules, build workflow,
voice, and the stack/architecture ramp. (Personal context and Claude
session/model guidance live in the Claude.ai project instructions, not here.)

## Git: READ-ONLY. Never run write operations.

Claude's sandbox can create files in this repo but CANNOT delete them.
Any git write operation (commit, add, merge, checkout, etc.) leaves
orphaned `.git/index.lock` / `.git/HEAD.lock` files behind that block
all future git operations until Tim deletes them manually in Explorer.

- NEVER run: `git add`, `git commit`, `git checkout`, `git merge`,
  `git stash`, or anything else that writes to `.git/`
- Read-only commands (`status`, `log`, `diff`, `show`) are fine, but
  always use `git --no-optional-locks <cmd>` — plain `git status` can
  briefly take `index.lock` too
- Commits are Tim's job (GitHub Desktop). When a commit is warranted,
  draft the commit message in chat for him to paste — but NOT until the
  work has actually been tested. See "Order of work" below.

### Commit message style: WHAT landed, not how or why

A commit message is an inventory of what changed, not an explanation of
it. Say what was accomplished and stop.

- Short imperative subject line, matching existing history ("Add hours
  editor, first-run gate, and derived-offline status", "Phase 2:
  recurring lunch break"). A `Phase N:` prefix is fine when it maps to a
  phase doc.
- Body is a flat bullet list of what now exists or behaves differently.
  One line each.
- NO rationale, NO "because", NO trade-offs considered, NO description of
  the bug's mechanism. If a sentence explains a decision, it doesn't
  belong here.
- Bugs fixed are listed as fixed, not diagnosed: "Fix meetings not
  refetching when the viewer's timezone changes" — not a paragraph on why
  the mount-only effect was wrong.

The reasoning still gets written down, just not here: `nextSteps.md` is
the decisions log and holds the why, the alternatives rejected, and the
failure modes. Code comments hold the local why. The commit message is
the index, and duplicating the reasoning across all three is what made
past messages long enough that nobody re-reads them.

Note this is a deliberate departure from commits before 8/3, which put
the full rationale in the body — don't pattern-match on those.

## How to build

- Implement changes directly via the Edit tool — build features, don't hand
  back snippets to type in. This is a real portfolio/learning project, not a
  copy-paste practice sandbox.
- Narrate as you go, in segments, like walking a junior dev through it: which
  file, what changed, how, and why — especially the non-obvious parts. Not a
  silent dump of edits, and not one big explanation bolted on at the end.
- Tim reviews via git diff / VS Code, so don't paste whole files back into
  chat. Short excerpts to make a point are fine.
- Skip fundamentals (React, JS/TS, HTTP) — Tim knows those. Focus on what's new
  or non-obvious, especially things that changed since he was last active
  (library versions, new patterns, tooling shifts).
- Task tracking lives in `nextSteps.md` — the canonical task list, decisions
  log, and known-issues list. README points to it. It gets updated at the END
  of a session, not as work lands — see "Order of work" below.

## Running the tests yourself (Claude): the node_modules workaround

`npm run test:run` FAILS in Claude's Linux sandbox, and the error is a red
herring — a `MODULE_NOT_FOUND` on `rolldown-binding.linux-x64-gnu.node`. The
cause is that `node_modules/` was installed on Windows, so the native binaries
are win32-x64. Same reason `npx vite build` fails. `tsc --noEmit` and
`npm run lint` are pure JS and work fine.

DON'T conclude from this that the tests can't be run and hand them to Tim
unverified. The util tests on BOTH halves import almost nothing, so a clean
install in a scratch directory pulls Linux binaries and runs them. Frontend
(vitest + dayjs):

```bash
rm -rf /tmp/vt && mkdir -p /tmp/vt/src/utils /tmp/vt/src/types
SRC=<repo>/frontend/src
cp $SRC/utils/*.ts /tmp/vt/src/utils/          # sources + *.test.ts
cp $SRC/types/index.ts /tmp/vt/src/types/
cd /tmp/vt && echo '{"name":"vt","private":true,"type":"module"}' > package.json
npm install vitest dayjs --silent --no-audit --no-fund
npx vitest run
```

Backend is the same shape — `shiftValidation.ts` imports nothing at all and
`meetingValidation.ts` imports only mongoose, so swap the copy paths for
`backend/src/utils` and install `vitest mongoose` instead.

Re-copy the changed file and re-run after each edit. This caught two real bugs
in `wallClockToInstant` on 8/8 that review had missed — including dayjs
silently rolling `99:99` over into a date four days later while reporting
`isValid() === true`. Worth the two minutes every time.

VERIFY BY MUTATION, not by going green. A suite that passes on its first run has
told you nothing yet — it might be asserting the wrong thing, or nothing at all.
Break the source in the SCRATCH COPY (never the repo) in a few targeted ways and
confirm the failures land where they should. On 8/12 this showed that a branch
of `validateBreakTimes` was unreachable rather than untested, which no number of
passing tests would have revealed and which changed what got written down about
the code.

COMPONENT TESTS RUN THE SAME WAY — corrected 8/17. This used to say that
anything importing React or a component needed a full dependency install that
was "slow and not worth it". It is neither. A throwaway directory with react,
react-dom, react-router-dom, dayjs, vitest, jsdom, @vitejs/plugin-react and the
three @testing-library packages runs the whole component suite in about ten
seconds, against the utils trick's two. Copy `src/components`, `src/context`,
`src/hooks`, `src/types`, `src/utils`, `src/test` and `config.ts` across, plus
`vite.config.ts` and the three tsconfigs, and both `vitest run` and `tsc -b`
work — the latter matters because neither Vitest nor ESLint type-checks
anything, so a type error in a test file passes both and only surfaces at build.
Do this rather than handing over unverified component tests.

On the backend the equivalent
wall is the Express app itself: importing any route pulls in native `bcrypt`,
which can't load in the sandbox, so Supertest-style route tests are blocked
until that's solved. Never `npm install` into the repo itself from the sandbox;
it would overwrite Tim's Windows binaries and break his machine.

## Order of work: build → test → THEN docs and commit

Within a session, do the work in this order and STOP at the boundary:

1. **Design/decide** where the phase calls for it. A `### DECISION:` block in
   `nextSteps.md` written BEFORE building is the exception to everything
   below — it's an input to the build, not a record of it, and it's cheap to
   amend if the build changes something.
2. **Build**, with `tsc` / harness checks as you go.
3. **Report what's ready to test**, and stop. List what Tim needs to run
   (lint, tests, browser QA) and what specifically to look for.
4. **WAIT.** Tim runs the tests and reports back.
5. Only then, and only after ASKING: write the `## COMPLETED` entry in
   `nextSteps.md`, update the README, CHECK CLAUDE.md (see below), and draft
   the commit message (see "Commit message style" above — the reasoning goes in
   `nextSteps.md`, the commit message just lists what landed).

On CLAUDE.md at step 5: check it, don't reflexively edit it. This file holds
CONVENTIONS and the architecture ramp, not session state — state lives in
`nextSteps.md` and `docs/decisions.md`, and that split is deliberate. So it
changes only when something it DOCUMENTS changed:

  - a new model, route, or route family
  - a new context value or method
  - a renamed route or page
  - a new invariant, or a permission rule that now differs from what's written

Most sessions hit none of those and should leave it alone. Bug fixes, UI
polish, copy changes and doc updates never touch it.

The reason it's on the checklist at all: it went stale between 8/7 and 8/11 and
had to be corrected in bulk — it still called `viewerId` live tech debt after
it was retired, never mentioned the Meeting model, and said nothing about the
display/write split, which is the most load-bearing invariant in the codebase.
A fresh chat reading it would have built on three wrong facts. Checking it at
the end of each session is what stops that accumulating again.

Why: writing the log before testing means rewriting it when something fails,
and it produces multi-commit churn where one clean commit would do. A
`COMPLETED` entry describing untested work is also just wrong — it hasn't
been completed, it's been written.

DO NOT write docs or draft a commit message unprompted at the end of a build.
Ask first ("ready for me to log this?"), because sometimes the answer is
"not yet, I found something." If Tim asks for docs explicitly, that's a green
light — just don't volunteer it.

Corollary: if testing turns up a fix, that fix belongs in the SAME session's
undocumented pile. Fix it, re-report, wait again. The docs describe the state
of things once, at the end.

## Voice & style (responses and code comments)

- Conversational and plain, as if explaining to a capable developer who's new
  to the specific topic. Everyday language; reach for technical terms only
  where they're actually needed, and briefly say what they mean on first use.
- Explain the "why" and the non-obvious parts, not just the "what".
- Keep it brief — short and clear beats thorough and long. If a sentence can be
  cut without losing meaning, cut it. No emojis (code or chat).
- Code comments follow the same voice: plain-language explanations of what a
  piece of code is doing and why, especially anything tricky or easy to get
  wrong. Assume the reader may be new to the concept. Keep them concise but
  understandable — explain the non-obvious "why," but don't over-explain what
  the code already makes clear.

## Stack & architecture (so a fresh chat ramps fast)

Full-stack TypeScript, two folders in one repo.

- `backend/` — Express 5 + TypeScript, Mongoose 9 / MongoDB. Run `npm run dev`
  (ts-node-dev, entry `src/server.ts`). Tests: Vitest (`npm test` watch,
  `npm run test:run` once), added 8/12 and covering `src/utils/*` only — the
  pure validation functions, no routes and no database. No lint script here.
  One-off
  scripts in `src/scripts/*.ts` run via `npx ts-node`; `migrateStatus.ts` and
  `migrateToRecurringShifts.ts` are the migration templates (they work on the
  raw Mongo collection, not the model, so they can touch fields the schema no
  longer declares). `syncIndexes()` runs on boot in non-production only.
- `frontend/` — React 19 + Vite 8 + TypeScript, Tailwind v4, react-router-dom
  v7, dayjs (utc + timezone plugins). Run `npm run dev`. Tests: Vitest on
  jsdom (`npm test` watch, `npm run test:run` once) — the pure-function suites
  in `src/utils/*.test.ts` plus component tests co-located with their
  components, sharing `src/test/renderWithProviders.tsx`. That helper injects a
  FAKE context, so anything testing TeamProvider's OWN logic (optimistic
  writes, the timezone fallback chain) has to mount the real provider and stub
  `fetch` instead — `TeamStatusSidebar.test.tsx` is the example to copy.
  Lint: `npm run lint`. Claude can run all of it despite the Windows/Linux
  binary mismatch — see "Running the tests yourself" above.

### Backend

- Models:
  - `TeamMember` (name, timezone, role, `status` enum
    `active`/`away`/`dnd`/`offline`, default `active`).
  - `UserBadge` (email, bcrypt password with `select:false`, role
    `admin`/`member`, `teamMemberId` ref) — login creds kept separate from team
    data on purpose.
  - `RecurringShift` (`teamMemberId`, `dayOfWeek` 0-6, optional
    `startTime`/`endTime` HH:mm, `isOff`; unique per member + dayOfWeek) — a
    member's standing weekly hours, one record per weekday.
  - `Meeting` (title, `startsAt`/`endsAt` as Dates, `attendeeIds[]`,
    `createdBy`) — the ONE model that stores UTC instants rather than wall-clock
    strings, because a meeting is a single moment that reads as a different
    clock per attendee. `attendeeIds` answers "am I in this", `createdBy` only
    decides who may delete.
- Auth: JWT in an httpOnly, `sameSite:lax` cookie. `authenticate` +
  `requireAdmin` middleware. Self-service writes trust `req.user.teamMemberId`
  from the JWT, NEVER a client-supplied id — `PATCH /api/team-members/:id/status`
  is the reference pattern to copy.
- SCHEDULE IDENTITY IS SELF-OWNED, and admin is an OVERRIDE for onboarding and
  absence. The three fields answering "when am I available" follow it:
  `status` is self-only, `hours` and `timezone` are self-or-admin. Anything new
  in that family should follow the same rule rather than inventing a fourth.
- Routes: `/api/auth` (login/logout/me); `/api/team-members` (writes admin-only
  except GET, the self-or-admin `PATCH /:id/status` and `PATCH /:id/timezone`,
  and the self-or-admin GET+PUT `/:id/hours` whole-week replace);
  `/api/recurring-shifts` (GET bulk, any authed user);
  `/api/meetings` (GET windowed by `from`/`to`, POST, DELETE — all authed with
  no admin gate; create requires the caller to be among the attendees unless
  admin, delete requires organizer-or-admin).
- Types live in `backend/src/types/index.ts` and are mirrored by hand in
  `frontend/src/types/index.ts` — keep both in sync.

### Frontend

- Routing (`App.tsx`): AuthProvider wraps all; ProtectedRoute gates by session
  then optional role; TeamProvider mounts only after auth. Members ->
  `/dashboard`, admins -> `/admin/schedule` (tabbed Schedule + Manage).
  ScheduleView is shared by both. `/profile` is the self-service page for both
  roles (timezone + weekly hours, one `HoursEditor mode="self"`); admins edit
  someone else's hours at `/members/:id/hours` and their profile fields inline
  on TeamMemberCard.
- Context: `AuthContext` (role, teamMemberId, isAuthenticated, login/logout,
  session restore via `/auth/me` on mount). `TeamContext` (members,
  recurringShifts, meetings, loading, setStatus with optimistic update +
  rollback, setTimezone, createMeeting, deleteMeeting, deleteMember,
  refreshAllData, plus the timezone values below). The legacy `viewerId`
  "simulate as user" was retired 8/7 — the viewer's zone now comes from the
  browser.
  `setTimezone` is deliberately NOT optimistic where `setStatus` is: a status
  click is one sidebar cell, a zone change redraws the whole grid, and
  optimistically showing a different day then rolling it back is worse than
  waiting for the round trip.

#### The display/write timezone split — the load-bearing invariant

TeamContext exposes THREE timezone values and they are not interchangeable:

  - `viewerTimezone` — `BROWSER_TIMEZONE || loggedInMember.timezone || 'UTC'`.
    The viewer's REAL zone.
  - `previewTimezone` — null by default, set by `TimezonePreview`. In-memory
    only; a preview is a transient action, not a saved preference.
  - `displayTimezone` — `previewTimezone ?? viewerTimezone`.

Only ScheduleGrid and TeamHoursPanel may read `displayTimezone`. MeetingPanel's
wall-clock -> instant conversion and the meetings FETCH WINDOW read
`viewerTimezone` unconditionally, so a preview can never reinterpret a write.
Without the split, someone previews Tokyo, books "2pm", and it lands 2pm
Chicago.

This is a CALL-SITE invariant. As of 8/17 two component tests hold it —
MeetingPanel booking on `viewerTimezone` with a preview active, and ScheduleGrid
following `displayTimezone` — both confirmed by deliberately swapping the
identifiers and watching them fail. They cover THOSE TWO CALL SITES ONLY, so a
new consumer of either identifier is unprotected until it brings its own test.
Treat any edit touching them as high-risk. `BROWSER_TIMEZONE` is read once at
module load.
- ALL shift/timezone logic funnels through `frontend/src/utils/scheduleTime.ts`
  (pure dayjs functions). `getCurrentShiftForMember` resolves a member's
  standing shift for today by the MEMBER's own local weekday, returning a
  working/off/unset resolution; `resolveHourRangeInViewerTz` converts a working
  resolution's hours into the viewer's timezone (anchored to today's date so
  DST is correct). Plus `resolveBreakCarveOutInViewerTz` for the standing
  lunch, `wallClockToInstant` (the meeting-booking half of the split — same
  wall clock in two zones yields two different instants), `isHourInRange`,
  `formatHourLabel`/`formatHourRange`/`formatWallClock`.
  This is the single place shift resolution lives — components import it, so a
  shift-model change happens here and every consumer inherits it. Covered by
  `scheduleTime.test.ts` (Vitest). `timeOptions.ts` (+ its own tests) builds the
  select options; shift bounds are hour-only, breaks quarter-hour.
- `status.ts` holds `STATUS_META` + `SETTABLE_STATUSES`, shared by the sidebar
  and admin card so colors/labels can't drift. `offline` is derived, not
  hand-settable, and guarded on both ends.
- Design system: colour/spacing tokens in CSS, `ThemedSelect` + `TimeSelect`
  wrapping the native select (popup styling behind `@supports`, Chromium-only
  so far), `buttonClasses` in `utils/ui.ts` — kept out of `Button.tsx` because
  a module exporting both a component and a plain function breaks hot reload.
- API base is `API_BASE` from `src/config.ts` (`VITE_API_URL` with a
  localhost:5000 fallback, baked in at BUILD time, not read at runtime); every
  fetch uses `credentials:'include'` to send the auth cookie.

## Current focus

See `nextSteps.md` for what's next, and `docs/decisions.md` for why anything is
the way it is — every `## COMPLETED` entry and `### DECISION:` block lives
there, newest first. Read it before changing anything non-obvious.

The recurring-shift rework, meetings, the 8/8 roadmap (12-hour clock, timezone
preview, responsive), self-owned schedule identity, and the test work on both
halves have all landed, and the `setStatus` refused-write rollback was fixed
8/23. What's left: deploy to Render + Atlas. Nothing else outstanding.
