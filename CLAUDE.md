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
unverified. The util tests import only vitest + dayjs, so a clean install in a
scratch directory pulls Linux binaries and runs them:

```bash
rm -rf /tmp/vt && mkdir -p /tmp/vt/src/utils /tmp/vt/src/types
SRC=<repo>/frontend/src
cp $SRC/utils/*.ts /tmp/vt/src/utils/          # sources + *.test.ts
cp $SRC/types/index.ts /tmp/vt/src/types/
cd /tmp/vt && echo '{"name":"vt","private":true,"type":"module"}' > package.json
npm install vitest dayjs --silent --no-audit --no-fund
npx vitest run
```

Re-copy the changed file and re-run after each edit. This caught two real bugs
in `wallClockToInstant` on 8/8 that review had missed — including dayjs
silently rolling `99:99` over into a date four days later while reporting
`isValid() === true`. Worth the two minutes every time.

LIMIT: utils only. Anything importing React, Vite or a component needs the full
dependency install, which is slow and not worth it — that's what the jsdom
DECISION in `nextSteps.md` is about. Never `npm install` into the repo itself
from the sandbox; it would overwrite Tim's Windows binaries and break his
machine.

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
   `nextSteps.md`, update the README, and draft the commit message (see
   "Commit message style" above — the reasoning goes in `nextSteps.md`, the
   commit message just lists what landed).

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
  (ts-node-dev, entry `src/server.ts`). No backend test runner yet. One-off
  scripts in `src/scripts/*.ts` run via `npx ts-node`; `migrateStatus.ts` and
  `migrateToRecurringShifts.ts` are the migration templates (they work on the
  raw Mongo collection, not the model, so they can touch fields the schema no
  longer declares). `syncIndexes()` runs on boot in non-production only.
- `frontend/` — React 19 + Vite 8 + TypeScript, Tailwind v4, react-router-dom
  v7, dayjs (utc + timezone plugins). Run `npm run dev`. Tests: Vitest
  (`npm test` watch, `npm run test:run` once). Lint: `npm run lint`.
  Claude can run the util tests despite the Windows/Linux binary mismatch —
  see "Running the tests yourself" above.

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
  - `WorkShift` (`teamMemberId`, `date` YYYY-MM-DD, `startTime`/`endTime`,
    `isBreak`, notes) — now just one-off dated breaks, not standing hours.
- Auth: JWT in an httpOnly, `sameSite:lax` cookie. `authenticate` +
  `requireAdmin` middleware. Self-service writes trust `req.user.teamMemberId`
  from the JWT, NEVER a client-supplied id — `PATCH /api/team-members/:id/status`
  is the reference pattern to copy.
- Routes: `/api/auth` (login/logout/me); `/api/team-members` (writes admin-only
  except GET, `/:id/status`, and the self-or-admin GET+PUT `/:id/hours`
  whole-week replace); `/api/recurring-shifts` (GET bulk, any authed user);
  `/api/work-shifts` (GET any authed user, writes admin-only).
- Types live in `backend/src/types/index.ts` and are mirrored by hand in
  `frontend/src/types/index.ts` — keep both in sync.

### Frontend

- Routing (`App.tsx`): AuthProvider wraps all; ProtectedRoute gates by session
  then optional role; TeamProvider mounts only after auth. Members ->
  `/dashboard`, admins -> `/admin/schedule` (tabbed Schedule + Manage).
  ScheduleView is shared by both.
- Context: `AuthContext` (role, teamMemberId, isAuthenticated, login/logout,
  session restore via `/auth/me` on mount). `TeamContext` (members,
  recurringShifts, loading, setStatus with optimistic update + rollback,
  deleteMember, refreshAllData). Note `viewerId` in TeamContext is legacy
  pre-auth "simulate as user" that still drives which timezone the grid
  previews — known tech debt, see `nextSteps.md`.
- ALL shift/timezone logic funnels through `frontend/src/utils/scheduleTime.ts`
  (pure dayjs functions). `getCurrentShiftForMember` resolves a member's
  standing shift for today by the MEMBER's own local weekday, returning a
  working/off/unset resolution; `resolveHourRangeInViewerTz` converts a working
  resolution's hours into the viewer's timezone (anchored to today's date so
  DST is correct). Plus `isHourInRange`, `formatHourLabel`/`formatHourRange`.
  This is the single place shift resolution lives — components import it, so a
  shift-model change happens here and every consumer inherits it. Covered by
  `scheduleTime.test.ts` (Vitest).
- `status.ts` holds `STATUS_META` + `SETTABLE_STATUSES`, shared by the sidebar
  and admin card so colors/labels can't drift. `offline` is derived, not
  hand-settable, and guarded on both ends.
- API base is hardcoded `http://localhost:5000`; every fetch uses
  `credentials:'include'` to send the auth cookie.

## Current focus

See `nextSteps.md`. Active workstream: the recurring day-of-week shift model
rework and its dependents (per-member hours page, break logging UI,
derived-offline status).
