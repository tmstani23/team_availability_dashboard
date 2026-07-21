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
  draft the commit message in chat for him to paste

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
  log, and known-issues list. README points to it. Keep it updated as work
  lands.

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
