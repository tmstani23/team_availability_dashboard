# Phase 2 — recurring lunch break

**Model: Sonnet, medium effort.** Contained, clear spec, but it's the first
change to the hours model since the recurring rework — so read
`scheduleTime.ts` fully before editing it.

**Prerequisite: Phase 1.** The status precedence layer this adds sits inside
a stack Phase 1 extends.

## Why this exists

Ad-hoc break logging was CUT (redundant with `away` once polling makes `away`
visible to other people). A standing weekly lunch is a different thing
despite the shared word: it's a *schedule* fact — known ahead, repeats,
computable from data already fetched — where an ad-hoc break is a *presence*
fact. That's why this one earns a model and the other doesn't.

It also delivers what breaks were originally wanted for: the Overlap Finder
stops suggesting times that land on someone's standing lunch, with no live
data needed.

## What to build

### Model

Optional `breakStart` / `breakEnd` (`HH:mm` strings) on `RecurringShift`.
One record per member per weekday, one break per day — that covers lunch. A
multi-break model is more general than needed; revisit only if a real second
break appears.

Mirror the type change in `backend/src/types/index.ts` and
`frontend/src/types/index.ts` (hand-synced, keep matching).

Validation on `PUT /api/team-members/:id/hours`: if one of `breakStart` /
`breakEnd` is present both must be, `breakStart < breakEnd`, and the break
must fall inside the day's shift. A break on an `isOff` day is invalid.

### Backend validation gap — fix it here

Tracked in KNOWN ISSUES and worth closing while you're in this route: shift
times are currently validated **only client-side**, in `HoursEditor`'s
`handleSave`. The grid renders whole-hour blocks, so shifts must start and
end on the hour and run at least an hour — but `PUT /api/team-members/:id/hours`
only checks that working days *have* a start and end, not their shape.
Anything hitting the API directly can store `09:30` and the grid silently
misrenders it.

Enforce the same three rules server-side (start < end, on-the-hour, ≥60min).
Then decide what the break's granularity rule is — see the open question
below — and apply it consistently.

### Time logic

`getCurrentShiftForMember` is the single place the stitch happens: it
resolves today's standing shift, and now layers the break window on top.
Every consumer (ScheduleGrid, TeamHoursPanel, TeamStatusSidebar, overlap)
inherits it automatically — that's the design, don't work around it by
resolving breaks in a component.

`getScheduleState` gains the break window too. Status precedence, full stack
after this phase:

1. no recent heartbeat → `offline`
2. off-shift → `offline`
3. in a standing break → away-ish (NEW, this phase)
4. whatever they set → as-is
5. never set anything → `away`

Decide what "away-ish" actually renders as — reusing `away` is the obvious
default, but if you introduce a distinct value it must go in `STATUS_META`
in `status.ts` and be non-settable like `offline` is (derived only, rejected
by the API, omitted from the picker). Write down which you chose.

### UI

- `HoursEditor` gains a per-day break row: optional start/end pair, disabled
  on `isOff` days.
- **ScheduleGrid renders the break as a carve-out inside the shift block —
  and you must build the carve-out GENERICALLY.** Lunch and meetings are
  cousins: both are "a carve-out from otherwise-available time drawn inside a
  shift block." Teach the grid to draw a carve-out once and Phase 3's
  meetings inherit it. Do not hardcode anything lunch-specific into the
  rendering path.
- The overlap row must exclude standing lunches — an hour where someone is at
  lunch is not an hour everyone is free.

### Open question to settle at the start

A 12:00–12:30 lunch in an hour-bucketed grid. Same granularity tension as the
shift times, but smaller. Rendering the whole 12:00 cell as lunch is probably
fine and needs no grid rework — but decide deliberately, because it
determines whether breaks are on-the-hour-only (matching shifts) or allowed
at half-hour granularity with the cell rounding outward. Record the decision
in `nextSteps.md`.

### Delete dead code

The `WorkShift` model and `/api/work-shifts` routes have had no reader since
the Phase 4/5 recurring cutover, and cutting ad-hoc breaks removed their last
planned use. Delete both here, plus any now-unused types and the frontend
type mirror. Keep `src/scripts/migrateToRecurringShifts.ts` — it's a
migration template and it works on the raw Mongo collection, not the model,
so it survives the model's deletion.

**Note the git constraint in CLAUDE.md: the sandbox can create files but
cannot delete them.** For actual file deletions, list the exact paths for Tim
to remove in Explorer rather than trying to delete them.

## Verify

- `npx tsc -b` clean both sides; `npm run lint` clean in `frontend/`
- New `scheduleTime.test.ts` cases: break inside shift, break at shift edges,
  break on an overnight shift, no break set (must behave exactly as today),
  malformed break times falling back safely. Plus the new precedence layer in
  `status.ts` tests.
- Vitest can't run in the Linux sandbox — verify via a compiled-JS harness,
  then have Tim run `npm run test:run` on Windows.
- Manually confirm the overlap row loses hours where a selected member has
  lunch.

## Log it

`## COMPLETED — Phase 2` entry in `nextSteps.md` with the granularity
decision, the away-ish decision, and confirmation the dead code is gone.
Remove the WorkShift dead-code entry, the client-side-validation entry, and
the one-standing-shift-per-member entry from KNOWN ISSUES. In the README:
Recurring Lunch Break moves `[Planned]` → `[Implemented]`, and the Shift Data
Model Rework entry's "slated for deletion" / "arrives with the recurring
lunch break" clauses become past tense.
