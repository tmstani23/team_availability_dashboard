# Phase 1 — polling + heartbeat presence

**The design is already settled** (below); the
work is implementation plus one genuine race condition to reason about.

**Prerequisite: Phase 0 must be done.** New fetches should use `API_BASE`.

## Why this exists

The app has no live presence. Two bugs, both real today:

1. `refreshAllData()` fires once on mount. Two users on different machines
   never see each other's status changes without a manual reload.
2. Nothing re-renders on a clock tick. `getScheduleState()` reads `dayjs()`
   at render time, so in an open tab a member whose shift ended at 5pm keeps
   showing their stored status indefinitely. The logic is correct — it just
   never gets asked again.

Bug 2 is the one people underestimate. A re-fetch alone does not fix it; the
component tree has to actually re-render on the tick. If you only wire up
polling and the fetched data happens to be identical, React may bail out of
re-rendering and the staleness survives. Make the tick itself a state change.

## The design (already decided — do not relitigate)

Polling + heartbeat, deliberately chosen over Socket.io. An open TCP
connection is a poor liveness signal: sockets sit half-open on dead networks
and disconnect events get missed, so socket presence needs a heartbeat layer
anyway. A timestamp is self-healing by comparison. Cost is ~45s of lag going
offline, which is acceptable.

Mechanism: clients poll every ~15s. Those requests are already authenticated,
so the server stamps `lastSeenAt` for `req.user.teamMemberId` on each poll.
"Here" means a heartbeat within ~45s — two to three intervals of grace, so
one dropped request doesn't flap someone offline. Laptop closes, polls stop,
stamp goes stale, everyone derives them offline on their next poll.

## What to build

### Backend

1. Add `lastSeenAt: Date` (optional, no default) to the `TeamMember` model
   and both mirrored type files (`backend/src/types/index.ts` and
   `frontend/src/types/index.ts` — these are hand-synced, keep them matching).
2. Stamp it on the authenticated `GET /api/team-members`. This piggybacks on
   a request that already happens, costing zero extra round trips, but it
   turns every read into a write. Debounce it: only write if the existing
   stamp is more than ~10s old. Do the write fire-and-forget — a failed
   heartbeat must not fail the read.
3. Serve `lastSeenAt` in the `GET /api/team-members` response.

Note: the heartbeat is keyed off `req.user.teamMemberId` from the JWT, never
a client-supplied id. `PATCH /api/team-members/:id/status` is the reference
pattern in this codebase — follow it.

### Frontend

4. **Build the refresh seam.** One hook — something like
   `frontend/src/hooks/useRefreshTick.ts` — that owns the single question
   "when do we refresh?" An interval calling `refreshAllData()` lives inside
   it. The seam is the whole point: consumers don't care where an update came
   from, only that data changed, so a later socket swap becomes "same hook,
   different engine" rather than a rewrite. Do not scatter `setInterval`
   calls through components.
5. **The tick must cause a re-render.** Have the hook also expose a `now`
   value (a `Date` or dayjs instance) that updates on each tick, and thread
   it into the components that compute derived status. `getScheduleState`
   already accepts an optional `now` parameter — pass the ticking value in
   rather than letting it default to `dayjs()` internally. That is what
   closes bug 2.
6. **Extend the precedence stack.** `resolveDisplayStatus` in
   `frontend/src/utils/status.ts` gains a heartbeat layer at the top:

   1. no recent heartbeat → `offline` (NEW — they are not here)
   2. off-shift → `offline` (existing)
   3. whatever they set → as-is
   4. never set anything → `away`

   Layers 1 and 2 don't conflict — off-shift and gone is offline either way.
   Layer 1 exists for the on-shift-but-actually-gone case, where a stored
   `active` is at its most misleading.

   Keep `status.ts` free of dayjs, as it is today. Pass the staleness
   decision in as a boolean (or pass `lastSeenAt` and `now` as plain
   millisecond numbers) rather than importing a date library into it. That
   split — time logic in `scheduleTime.ts`, display logic in `status.ts` — is
   deliberate.
7. A member with no `lastSeenAt` at all (never logged in) must NOT derive
   offline via layer 1. That's an absence of information, same reasoning as
   "hours not set" — it falls through to their stored status, which defaults
   to `away`.

### The race to watch for

`setStatus` in `TeamContext` does an optimistic update with rollback. An
in-flight poll can land between the optimistic update and the server
confirming, overwriting the new value with the old one and flickering the UI
back. The existing rollback logic does not cover this — it only handles a
failed request. Options: skip applying poll results while a status write is
in flight, or version the writes and discard stale responses. Pick one,
implement it, and write down which and why.

## Tuning

Interval ~15s, staleness threshold ~45s. Put both in one named constant each,
near the hook, so they're tunable after real use.

## Verify

- `npx tsc -b` clean both sides; `npm run lint` clean in `frontend/`
- Extend `status.ts` tests for the new precedence layer, including the
  never-logged-in case. Note: **Vitest cannot run in the Linux sandbox**
  (node_modules has Windows/native bindings). Verify via a compiled-JS
  harness — that pattern is used throughout this project's history — and then
  tell Tim to run `npm run test:run` on Windows to confirm.
- Two browser profiles, logged in as different members: change status in one,
  confirm it appears in the other within ~15s.
- Leave a tab open across a shift-end boundary (or temporarily shorten the
  threshold to test) and confirm the member flips to offline without a
  reload. This is bug 2 — test it explicitly, it's the one that looks fine
  until it isn't.
- Close one profile entirely and confirm that member derives offline in the
  other within ~45s.

## Log it

Add a `## COMPLETED — Phase 1` entry at the top of `nextSteps.md` covering
what landed, the race-condition decision you made, and the actual tuned
interval/threshold values. Remove both live-sync entries from KNOWN ISSUES.
Update the README: the Live Sync bullet moves from `[Planned]` to
`[Implemented]`, the two Known Issues bullets go, and the "Live Sync lands"
forward-reference in the Live Availability Sidebar entry becomes present
tense.
