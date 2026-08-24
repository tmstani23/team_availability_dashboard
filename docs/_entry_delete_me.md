## COMPLETED — Deploy prep, first-admin seeding, and session revocation (8/24)

The last roadmap item, started as deploy prep and ended somewhere else: three
bugs surfaced during QA of the prep itself, all in auth, and fixing them was
worth more than getting to Render an hour sooner. Render and Atlas are still
untouched - what landed is everything that has to be true BEFORE a host sees
this repo, plus what the testing shook loose.

### Part 1 - what deploy needs that didn't exist

**A build.** `backend/` had only `dev` and `test`, so there was no `dist/` to
run. Added `build: tsc` and `start: node dist/server.js`, and excluded
`src/**/*.test.ts` from the build in `tsconfig.json` - dist/ now holds only what
the server runs, and the build doesn't need vitest resolvable on a host that
installed production dependencies only.

**Express serves the frontend.** `express.static` on `../../frontend/dist` plus
a fallback so client routes survive a hard refresh. One service, not two, and
that's load-bearing rather than tidy: same origin is what keeps the auth
cookie's `sameSite: 'lax'` working, and splitting the domains would force
`'none'` + `secure`, the third-party-cookie pattern browsers keep tightening.

Two things worth knowing about that block. The relative path is the same hop in
both worlds - `__dirname` is `backend/src` under ts-node-dev and `backend/dist`
after a build, and both sit two levels below the repo root - so it needs no
environment-dependent branch. And the fallback is written as `app.use`, not the
familiar `app.get('*')`: Express 5 upgraded path-to-regexp and a bare `*` is no
longer a valid path pattern, it throws on startup asking for a parameter name.
Requests under `/api/` fall through to a real 404 rather than being handed the
HTML shell, which otherwise surfaces as `Unexpected token <` in a fetch.

The plain-text `GET /` health line is now dev-only. Left registered, it would
shadow the app's own home page in production.

**`secure: true` on the cookie**, driven by `NODE_ENV` rather than hardcoded,
with the same attributes mirrored onto the logout `clearCookie`. It has to stay
off locally: localhost is plain HTTP, and a secure cookie there is set and then
never sent back, so you log in and immediately look logged out.

**`trust proxy` in production.** Render terminates HTTPS at its edge and
forwards plain HTTP, so `req.protocol` would read `http` and `req.ip` would be
the proxy's. Production only - believing forwarded headers with no proxy in
front of you lets any client claim any IP.

**The `VITE_API_URL` trap, closed.** This was the flagged risk and it deserved
the flag: the variable is baked in at BUILD time, there was no `frontend/.env`,
and a production build with it unset shipped a bundle silently pointing at
localhost:5000. The fallback in `config.ts` now splits on `import.meta.env.PROD`
- dev keeps localhost, a production build with nothing set gets `''`, which
makes every fetch a relative `/api/...` path that lands wherever the page came
from. That is the correct answer for the one-service setup, so it's now the
default rather than something to remember. `frontend/.env.production` was added
alongside to make it explicit; it's committable, since `.gitignore` excludes
only `.env` and `*.local`.

**`.env.example` corrected.** It claimed the local database was
`team-availability-dashboard`; the real one is `team_availability`. A wrong name
here doesn't error, it silently connects to an empty database, which reads as
"my data vanished". Also documented the two new optional seed vars and what
`NODE_ENV=production` now switches on - it's four things, not one.

### Part 2 - seedAdmin.ts, the flagged blocker

Built to the 8/23 decision, unchanged in shape: reads `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD`, refuses an email that already has a badge rather than
overwriting it, and creates the linked `TeamMember` + admin `UserBadge` pair at
the same `SALT_ROUNDS = 10`. Name and timezone are optional, defaulting to
`Admin` and `UTC`, since neither is a secret and both are editable from
`/profile` the moment you can log in.

Two details not in the decision. The member has to be created first, because
the badge needs an id to point at - so if the badge insert then fails, the
script deletes the member it just made, rather than leaving an orphan that shows
on the dashboard and can never be logged into. And `||` rather than `??` on the
optional vars, so a present-but-empty `SEED_ADMIN_TIMEZONE=` falls back too;
blank values sitting in a `.env` are the normal state of that file.

**A gap QA found immediately.** The first run wrote `timezone: Engineerio` -
a stray value from a duplicated line in `.env` - and the script accepted it
without complaint. That is a real hole: `PATCH /api/team-members/:id/timezone`
rejects exactly this with `Unknown timezone: ...`, so the script was a fourth
surface writing that field and the only one not validating. An invalid zone
doesn't fail at write time; it fails later, when `dayjs().tz()` throws while
formatting that member's clock. Now checked with the same
`new Intl.DateTimeFormat('en-US', { timeZone })` in a try/catch the route uses,
before connecting - a bad value is worth nothing to a database.

### Part 3 - the token was a snapshot, and three bugs fell out of that

Found by accident: logging into a freshly seeded `seed-test2` didn't ask for
credentials at all, and showed an admin view it had never issued. The cause was
that `authenticate` verified the JWT's signature and then trusted the payload -

```ts
const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
req.user = decoded;
```

A valid signature proves the token was minted here and not edited. It proves
nothing about the present. The payload is who you were at login and it keeps
looking true for the full 24h whatever the database says afterwards:

- **Deleted users kept working.** `DELETE /api/team-members/:id` removes the
  badge with the member, but nothing read the badge.
- **Demoted admins kept admin.** `PATCH /:id/role` writes `badge.role`, while
  `requireAdmin` read `req.user.role` - which came from the token.
- **Tokens crossed databases.** Sessions were bound to `JWT_SECRET`, not to any
  data, so pointing `MONGODB_URI` elsewhere left everyone logged in against a
  database that had never heard of them. That's what produced the phantom admin
  view above.

`authenticate` now looks the badge up by `decoded.id` and builds `req.user` from
it - only the id survives from the token, role and `teamMemberId` are read fresh.
A missing badge is a 401 with a distinct message (`Session no longer valid`) so
it's tellable from an expiry in devtools; a database error stays a 500, since a
Mongo blip should not log everyone out wearing the costume of an expiry.

Deploy consequence worth carrying forward: use a DIFFERENT `JWT_SECRET` on
Render than locally. Same secret across environments means a token minted
against one database authenticates against the other.

### Part 4 - what testing that change exposed

**A promoted user was stranded.** Promote a member mid-session and their tab
never gains the Manage tab, because role-based landing runs once, at login, via
`LoginRoute` and `homePathForRole`. `/dashboard` renders `DashboardLayout`,
which has no tabs, and nothing moves them. `utils/routes.ts` had already
predicted this in a comment written about post-login landing. `/dashboard` now
renders through a small `DashboardRoute` that asks `homePathForRole` where the
current role belongs and redirects if the answer isn't `/dashboard`.

Deliberately NOT `ProtectedRoute requiredRole="member"`: that component's
wrong-role branch redirects to `/dashboard`, so an admin would bounce between
the two forever.

**The last admin could be deleted.** `PATCH /:id/role` refuses to demote the
last remaining admin. `DELETE /:id` had no equivalent, so an admin could delete
the last admin - themselves included - and leave zero. Same lockout the seedAdmin
decision was written about, reachable by a different door, and two routes
disagreeing about a rule they both enforce. The delete route now runs the same
`countDocuments` check, before the delete rather than after.

**A dead session left the app looking empty rather than logged out.** Deleting
a logged-in member evicted them server-side correctly, and the client showed
full chrome with zero rows, no identity, and the first-run hours prompt
inviting them to save something the server would refuse. The cause is one line:

```ts
const fetchedMembers = Array.isArray(membersData) ? (membersData as TeamMember[]) : [];
```

That narrowing exists so an error-shaped body can't crash the grid - and it
turns a 401's `{ message }` into `[]`, which is indistinguishable from an empty
team. The defence against crashing was also what swallowed the auth failure.
`refreshAllData` now checks `membersRes.status === 401` before the narrowing and
calls `logout()`, which clears auth state, lets `ProtectedRoute` redirect, and
unmounts the provider with its interval. The tab lands on `/login` within one
poll. Checked on the members response alone: all three requests carry the same
cookie through the same middleware, so they succeed or fail together.

This covers the POLL. A one-off action that 401s still fails in place with
whatever it shows today; the poll evicts within 15 seconds regardless, so the
gap is one interval rather than indefinite.

### Part 5 - deleteMember tells the truth now

The 8/23 entry above says `deleteMember` was left alone because it "has the same
shape but no refusable path". That was true when it was written and stopped
being true in Part 4 - the last-admin guard is exactly a refusable path. So the
signature moved to `Promise<{ success, message }>`, matching `deleteMeeting`,
`createMeeting` and `setTimezone`, and `TeamMemberCard` grew a `deleteError`
beside its existing `editError` / `badgeError` / `roleMsg`. That's the same test
8/23 set: change the signature when there's a refusal to show, not before.

`renderWithProviders`' fake context needed the stub widened too, and `tsc`
caught it - the seam the 8/17 entry warns about, behaving as documented.

**And then it flashed.** First cut kept the optimistic removal. The message
appeared for a frame and vanished, because `deleteError` is state on the card
and the card is what gets removed: filter the member out, the card unmounts,
the 400 arrives, the list is restored, and a fresh card mounts with empty state.
The message was being set on an instance that no longer existed.

So member delete is no longer optimistic. It awaits the response and filters
only on success; there's no snapshot because nothing is removed to restore.
`deleteMeeting` keeps its optimistic pattern deliberately - its error surface
isn't inside the row being removed, so it doesn't eat its own message - and
delete-a-member already costs a confirm dialog, so a few hundred milliseconds
buys nothing worth this.

### QA (Tim, browser + devtools, 8/24)

Existing behaviour first, two profiles: statuses, derived offline, per-member
local times across zones, meeting carve-outs on attendee rows, cross-session
sync. Unaffected.

`seedAdmin.ts` against a brand-new empty database (`seed-test2`, created by
naming it - Mongo makes a database on first write): clean create, then a second
run correctly refused on the duplicate email, and the `UTC` fallback exercised
by leaving the optional var commented. Logged in as the seeded admin against a
database with one member - the first time this app has booted against an empty
database, which is the Atlas condition.

Session revocation: swapping `MONGODB_URI` mid-session bounced to login rather
than silently showing the other database. Promotion took effect without a
re-login once the redirect landed. Deleting a logged-in member rerouted them to
login and they could not log back in. A member hitting `/admin/schedule` still
lands on `/dashboard` and stays there - the loop check the redirect could
plausibly have broken.

Last-admin delete, on `seed-test2` rather than the real database deliberately:
`400`, 52 bytes, which is exactly
`{"message":"Cannot delete the last remaining admin"}`, and after Part 5 that
wording renders on the card with the row staying put.

`npm run test:run` green on both halves, lint clean.

### Still not covered

No automated test was added for anything here. Everything above is manual QA,
and the highest-risk code in the project just changed - `authenticate` now has
a database lookup and a third failure mode, and none of it is pinned. That
remains blocked on the same `bcrypt` import chain as the rest of the backend
auth testing.

Two `seedAdmin.ts` guards were never exercised: the invalid-timezone refusal
(the fix was written after the value that prompted it had been removed from
`.env`) and the missing-required-var bail.

A DEMOTED admin still keeps a stale Manage tab until they reload, since
`AuthContext` reads `/auth/me` once on mount. Harmless - the backend refuses
with 403s now - but it's the mirror of the promotion case and only the
promotion half got fixed. See nextSteps.md.

### DECISION: authenticate reads the badge, not just the token (8/24, built 8/24)

THE PROBLEM. Above, in Part 3. Three symptoms, one cause: authorization was
being read from a signed snapshot rather than from the data.

THE CHOICE. Three shapes considered.

*Look up in `requireAdmin` only.* Cheapest - the lookup happens on admin-gated
routes, which are rare. Rejected: it catches demotion and misses deletion
entirely, since a deleted member never touches an admin route while polling.
That's the worse half to miss, because it's the one that keeps working for
someone who has been removed.

*A token-version field on `UserBadge`, bumped on role change and delete.* The
usual answer when the lookup genuinely costs something. Rejected because the
lookup doesn't: you still have to read the badge to compare versions, so it
collapses into the same query plus a field to maintain.

*Look up in `authenticate`, take role and teamMemberId from the badge.* Chosen.
The cost argument that usually rules this out doesn't survive the numbers here:
the frontend polls every 15s (`POLL_INTERVAL_MS`) and each poll is three
requests, so one client is ~12 requests a minute, every one of which already
queries Mongo for the data it returns. Adding one indexed `_id` lookup to
requests that were never free is not a number worth optimising at this scale.

WHAT IT COSTS. Auth used to be pure CPU and now needs the database reachable,
so a Mongo outage becomes a login outage rather than only a data outage. That's
the trade for revocation working at all, and it's why a failed lookup answers
500 rather than 401 - a blip should not masquerade as an expiry and log
everyone out.

WHEN THIS WOULD HAVE BEEN WRONG: a read-heavy API with no polling and a real
per-request budget, or a token lifetime short enough that staleness expires
faster than anyone notices. Neither is this project - 24h tokens and a 15s poll
are the opposite of both.

### DECISION: first admin comes from a seedAdmin script, not boot-time bootstrap (8/23, built 8/24)

Moved verbatim from `nextSteps.md`, where it was written on 8/23, on the same
rule as every other DECISION block: it lives next to the COMPLETED entry it
produced.

THE PROBLEM. A fresh Atlas database has zero `UserBadge` documents, and every
door into creating one is admin-gated: `/auth/register` is gone (replaced by
`POST /api/team-members`, which is `requireAdmin`), and `PATCH /:id/role` is
admin-only too. So nobody can log in, so nobody can create anyone. The local
admin predates this - it came from the old register flow, and that door is
shut. `resetAdminPassword.ts` only resets an EXISTING badge; its own error
message says to "use seedAdmin.ts instead", and that file has never existed
(no git history for the path). Deployed, this stops the app cold.

THE CHOICE. Considered a boot-time bootstrap - if `UserBadge.countDocuments()`
is 0, create the admin from env - and rejected it. Its one real advantage is
needing no shell on the host, and that advantage doesn't apply: the script can
run from Tim's laptop with `MONGODB_URI` pointed at Atlas (allowlist the IP).
What's left is cost. `SEED_ADMIN_PASSWORD` would have to live in Render's env
permanently, since the code reads it on every start, where a script lets you
set the two vars, run once, and delete them. And "zero badges" is true on
first boot AND whenever something is already wrong - wrong cluster in
`MONGODB_URI`, a dropped collection, a staging DB sharing config - so the
failure mode isn't "bootstrap didn't run", it's "bootstrap ran when it
shouldn't have", silently, with a months-old env password. Startup code with
privilege is a new category for this codebase; a one-off script in `scripts/`
is not - `migrateStatus.ts` and `migrateToRecurringShifts.ts` are already
exactly that, and `resetAdminPassword.ts` already uses these same two vars.

WHAT TO BUILD. `backend/src/scripts/seedAdmin.ts`, sibling to
`resetAdminPassword.ts` and following its shape: read `SEED_ADMIN_EMAIL` and
`SEED_ADMIN_PASSWORD` (both already in `.env.example`), bail if either is
missing, connect, and create the linked `TeamMember` + `UserBadge` pair with
`role: 'admin'` and a bcrypt hash at the same `SALT_ROUNDS = 10`. Refuse if a
badge with that email already exists rather than overwriting - resetting a
password is the other script's job, and the two shouldn't be able to be
confused for one another. Delete the env vars from Render once it has run.

WHEN THIS WOULD HAVE BEEN WRONG: a host with genuinely no route to the
database, or a self-hosted product where "run this script" is a support
burden. Neither is this project.

BUILT 8/24, as specified, plus two things this block didn't anticipate: an
orphan-cleanup path if the badge insert fails after the member is created, and
IANA validation on the optional timezone var. See the COMPLETED entry above.

