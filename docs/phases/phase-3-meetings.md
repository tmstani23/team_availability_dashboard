# Phase 3 — meeting model

**Two sessions, deliberately. Do not merge them.**

- **Step A (design pass): Opus, or Sonnet high effort.** Four questions to
  settle plus one genuinely new timezone concept. This is the only place in
  the remaining roadmap where a cheap model can produce something that
  compiles, passes tests, and is quietly wrong.
- **Step B (build): Sonnet, medium effort.** Once Step A's decisions are
  written into `nextSteps.md`, the build is ordinary work.

**Prerequisite: Phase 2**, specifically its generic carve-out rendering —
meetings reuse it.

## Why this exists

The Overlap Finder dead-ends: it tells you when everyone is free, then hands
you off to an external calendar. A meeting model closes the loop — find
overlap, book it, see it on the grid — and reuses the timezone and grid
machinery already built.

## Scope edge — hold this line

Create / view on grid / delete. Single occurrence. **No** invites, RSVPs,
notifications, conflict warnings, recurrence, or calendar sync. Meetings
attract features endlessly; anything past that line is a separate decision,
not an implementation detail to be absorbed mid-phase.

## THE TRAP — read this twice before writing any code

Meetings have **different timezone semantics from everything else in this
codebase.**

Standing hours are **wall-clock-local**: "9am wherever you are" is a
*different instant* for each person. That's why they're stored as `HH:mm`
strings with no date and no offset.

A meeting is **one fixed instant** that reads as a *different wall-clock
time* for each attendee. So meetings store a **UTC datetime**, NOT an `HH:mm`
string like every other time field in the project.

Consequences:

- Wall-clock is the only pattern in the codebase today, so `scheduleTime.ts`
  needs a **genuinely new function** (instant → viewer's clock), not an
  adaptation of an existing one. Do not extend `resolveHourRangeInViewerTz`
  to handle both — that's exactly how the two get mixed.
- Mixing the two is the classic scheduling bug and it is not loud. It looks
  correct for every attendee in the same timezone as the author, and for
  everyone else it's off by their offset. Test cross-timezone explicitly.
- DST: an instant converted to a wall clock must be converted *at that
  instant's date*, not today's. The existing code anchors to today's date on
  purpose because recurring records carry no date — meetings do carry one,
  and must use it.

## Step A — design pass (settle these, write them into nextSteps.md)

1. **Who can create a meeting for whom?** Compare to the existing pattern:
   self-service writes trust `req.user.teamMemberId` from the JWT, never a
   client-supplied id, and admins can act on anyone. A meeting has *multiple*
   attendees, which is the first write in this app that isn't about a single
   member — so the existing pattern doesn't answer it cleanly. Decide whether
   any member can add others as attendees, or only admins.
2. **Does an in-progress meeting affect displayed status?** Compare directly
   with the lunch precedence decision from Phase 2 — if lunch derives
   away-ish, consistency argues meetings do too. But a meeting is arguably
   the most "actively working" a person gets. Decide and justify; if yes, it
   slots into the same precedence stack.
3. **Does the overlap row account for booked meetings?** If overlap says
   "everyone is free at 2pm" while a meeting is already booked at 2pm, the
   feature is lying. Weigh against scope creep.
4. **Grid rendering for cross-day edge cases.** The grid shows one day, in
   the viewer's timezone. A meeting instant can land on a different calendar
   day for different attendees. Decide what the grid shows.

Also read the existing `RecurringShift` and `WorkShift` history in
`nextSteps.md` before modeling — `WorkShift` was a dated model that got
deleted, and it's worth being sure the meeting model isn't reinventing its
mistakes.

Step A produces **no code** beyond possibly a type sketch. It ends with a
`### DECISION: meeting model — design pass` block in `nextSteps.md`.

## Step B — build

Only start once Step A's decisions are written down. Broad shape:

- `Meeting` model: title, `startsAt` / `endsAt` as UTC `Date`, attendee refs
  to `TeamMember`. Index on `startsAt`.
- Routes: create, list (probably scoped to a date range), delete. Auth per
  Step A's decision 1.
- New `scheduleTime.ts` function converting a UTC instant to the viewer's
  local hour range, anchored to the meeting's own date.
- Grid rendering via Phase 2's generic carve-out.
- Types mirrored by hand in both `types/index.ts` files.
- Tests: a cross-timezone pair and a DST-boundary pair are mandatory, not
  optional. Vitest can't run in the Linux sandbox — compiled-JS harness, then
  Tim runs `npm run test:run` on Windows.

## Log it

`## COMPLETED — Phase 3` in `nextSteps.md`. README: Meeting Model moves
`[Planned]` → `[Implemented]`, and the Meeting Overlap Finder entry's
"hands you to an external calendar" framing gets updated since that's no
longer where it dead-ends.

## After this phase

The roadmap's remaining items, all small and independent:

- Retire the `viewerId` "Simulating Active User" dropdown (last piece of
  pre-auth simulation code — Phase 1 makes it actively confusing, since
  "simulating" another user alongside real presence is a strange affordance).
- Deploy to Render + Atlas (research is in `nextSteps.md`; possible any time
  after Phase 0, and earlier is better for testing Phase 1 properly).
- Design pass (button colors, card polish, the `bg-zinc-800`-on-`bg-zinc-800`
  input issue in `AddTeamMemberForm`).
- Backend test coverage: auth logic via Jest, API routes via Supertest.
