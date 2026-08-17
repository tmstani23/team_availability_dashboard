# Distributed Team Availability Dashboard

A workspace visualizer built to coordinate global engineering workflows across multiple time zones. This application eliminates manual time arithmetic by serving as a single source of truth for distributed team schedules, availability statuses, and meeting windows.

*Status: in development. Scheduling, timezone, auth, live cross-session sync, recurring lunch breaks, and the meeting model all work. Remaining work is polish and cleanup — see `nextSteps.md`. Feature entries below are labelled individually.*

## Goals & Design Constraints

The problem this solves: coordinating engineers across time zones normally means manual time-zone math, spreadsheet tracking, and constant "are they online right now?" messaging. This dashboard replaces all of that with one live, visual source of truth. Three constraints drive the design:

- **Zero manual math** — all UTC / time-zone conversion stays hidden behind the UI; a user only ever sees their own local clock.
- **High scannability** — a manager or teammate should be able to read someone's current availability in under two seconds.
- **Data accuracy across date boundaries** — overnight shifts (e.g. 8pm–5am) are supported end to end, including a standing lunch that itself crosses midnight; durations are measured forward with a wrap rather than subtracted, and break containment is expressed as an offset from the shift's own start so the wrap never leaks into the comparison. Because this is a *presence* tool ("who is on shift right now?"), each member's current shift resolves against **their own local weekday**, not the viewer's. Near midnight two people can be on different weekdays; the grid shows each person's real current day, then converts the hours to the viewer's clock.

## Core Project Features

Status legend: Implemented / Planned / Cut *(cut entries stay — the reasoning is more useful than silence)*

*   **[Implemented] Global Schedule Matrix Grid**: An interactive daily timeline that visually plots individual team members' work shifts side-by-side.
*   **[Implemented] Automatic Context Time-Shifting**: Dynamically converts and renders all team schedules into the local time zone of the currently viewed user.
*   **[Implemented] Authentication & Role-Based Access**: JWT-based sessions stored in an httpOnly cookie, with `admin` / `member` roles gating routes on both the API (`authenticate` / `requireAdmin` middleware) and the frontend (`ProtectedRoute`, role-aware layouts). Covers login, logout, and admin-only actions (member management, role promotion, password reset).
*   **[Implemented] Live Availability Sidebar**: A real-time tracking panel showing each team member's current status, with a "viewer" selector to preview the dashboard as different team members. Each row shows that member's current local time tagged with their zone ("10:41 AM · Sydney") — a bare clock tells you someone says 10:41 but not whether they're an hour ahead of you or fifteen. The city is derived from the stored IANA string rather than stored separately, so a member's zone keeps exactly one source of truth. `TeamMember.status` is a four-value enum — `active` / `away` / `dnd` / `offline` — replacing the old `isAvailable` boolean. Members set their own status via a picker (active/away/dnd), keyed to real auth (`AuthContext.teamMemberId`). What a member *displays* as combines the schedule with what they set, in this order:

    1. **Off shift → `offline`** — derived, and it overrides whatever they set. A stored status is a snapshot of a moment someone clicked a button; "they are outside their own working hours right now" is a harder fact.
    2. **Otherwise → whatever they set.**
    3. **Never set anything → `away`.** The stored default is `away`, not `active`: `active` claims someone is present and available, which only the person can assert truthfully.

    `offline` is deliberately not hand-settable (rejected by the API and omitted from the picker) — it can only come from the schedule, so it never blurs with a manual choice. A member with no hours on file is *not* derived offline: that's an absence of information, not evidence they're off, and the UI labels it "Hours not set" instead.

    Three derived layers wrap around these. Above: a member with no recent heartbeat derives as `offline` regardless of shift, covering the on-shift-but-actually-gone case where a stored `active` is at its most misleading. Below that: a member in a booked meeting derives as `meeting`, and one inside their standing lunch derives as `break`. All are derived-only and rejected by the API, same as `offline`.
*   **[Implemented] Meeting Overlap Finder**: A scheduling tool that scans selected team profiles and highlights the exact hours where everyone shares overlapping availability. Checkbox picker (`TeamHoursPanel`) drives an overlap row in `ScheduleGrid`, lit only where every selected member is active. Started as pure frontend against existing shift data; since the meeting model landed it no longer dead-ends — the hours it highlights can be booked in place, and the row excludes anything already booked so it can't propose a slot it just filled.
*   **[Cut] Ad-hoc Break Logging**: Quick-action controls for logging temporary absences. Dropped as redundant with the `away` status. It only looked necessary because `away` didn't reach anyone — with no live sync, setting it changed nothing on a colleague's screen. Now that polling has landed, "I'm stepping out" is served by a control that already exists. The dated `WorkShift` model behind it was deleted along with its routes.
*   **[Implemented] Recurring Lunch Break**: A standing daily break window (e.g. "12:00–12:30") inside a member's weekly hours, set per weekday alongside the shift times. Distinct from the cut feature despite the shared word: a standing lunch is a *schedule* fact — known ahead, repeats, needs no live data — where an ad-hoc break is a presence fact.

    It renders as a **carve-out** drawn inside the shift block: the grid keeps whole-hour cells, but a cell containing a break is filled fractionally with a hard stop, so a 12:00–12:30 lunch fills exactly half of the 12:00 cell rather than blanking the hour. Quarter-hour tick marks appear only on cells that contain a carve-out — enough of a ruler to read the boundary, without a permanent grid overlay. Breaks may therefore land on a quarter hour, where shift times must stay on the hour: a shift boundary decides whether a whole cell lights up, so it can't be finer than a cell, while a carve-out is drawn inside one.

    A member inside their lunch window displays as **`break`** ("At lunch") — a derived, non-settable status like `offline`, sitting below the heartbeat in the precedence stack (a lunch is a plan; a heartbeat is evidence). The Overlap Finder excludes any hour a selected member's lunch touches, strictly: losing 45 usable minutes is cheaper than proposing a slot that lands on somebody's lunch.

    The carve-out renderer is deliberately generic — it takes fractions of a cell and knows nothing about lunches. Meetings turned out to be the same visual idea and reuse it.
*   **[Implemented] Recurring Weekly Hours**: Each person's normal working hours recur by day-of-week (e.g. "Monday: 9–5", "Friday: 9–1") rather than requiring the same shift every day. The grid still shows one day at a time; which shift displays resolves automatically from the member's own current weekday via `RecurringShift` records. No visual weekly view. Members set their own week at `/profile`, alongside their own timezone (admins can edit anyone's hours at `/members/:id/hours`) — seven weekday rows, each a time range or an "off" toggle, saved as one whole-week replace. New members start with no hours at all and are prompted to set them on first login; until they do, the UI distinguishes three states everywhere it matters — working, explicitly **off today**, and **hours not set** — since an empty row would otherwise read as "not working" when it means "we don't know yet".

## Technical Architecture

The application is structured as a full-stack system utilizing strict type-safety boundaries:

*   **[Implemented] Frontend**: React (Vite-powered) combined with TypeScript (`.tsx`) for strict component interface data definitions and predictable UI state.
*   **[Implemented] Backend Engine**: Express.js server logic built entirely in TypeScript, processing incoming payloads, middleware routing, and timezone normalization.
*   **[Implemented] Data Validation Layer**: Strict type-checking utilizing structural interfaces to eliminate data corruption across timezone offsets and scheduling arrays.
*   **[Implemented] Storage Layer**: MongoDB collections using indexed Mongoose schemas.
*   **[Implemented] Shift Data Model Rework**: Standing shifts key off `dayOfWeek` (recurring, not date-bound) in a `RecurringShift` model, which also carries the optional standing lunch. The frontend reads them through `scheduleTime.ts`, which resolves each member's current-weekday shift into three states (working / off / unset) and, from that, whether they're currently `on-shift` / `off-shift` / `on-break` / `unknown` on their own clock — the signal the derived status layers run on. Same-day carve-outs are layered on in that same resolution step, so every consumer inherits them. The older date-based `WorkShift` model and its routes were deleted once ad-hoc breaks were cut.
*   **[Implemented] Live Sync — polling + heartbeat presence**: Short-interval polling (~15s) so status changes propagate between sessions, paired with a `lastSeenAt` heartbeat stamped on each authenticated poll. No heartbeat inside the staleness window (~45s) derives as `offline` — which is what makes `active` an earned signal rather than a stored claim from whenever someone last clicked.

    Socket.io was the original plan, reconsidered because an open connection is a poor liveness signal on its own — sockets sit half-open on dead networks and disconnect events get missed, so socket presence needs a heartbeat regardless. A timestamp is self-healing by comparison. Polling gets the same property without a persistent-connection deployment, costing ~45s of lag going offline. The refresh logic sits behind a seam so the transport can be swapped later.
*   **[Implemented] Design System**: Tailwind v4 `@theme` tokens in `index.css` naming surfaces, lines, text, brand and schedule colours by the job they do rather than the colour they are (`bg-card`, not `bg-zinc-800`). One rule holds it together: **chrome and data never share a hue** — violet means "you can interact with this" and nothing else, while sage/rose mean what's on the calendar and never appear on a control. That rule exists because they once collided exactly: the primary button and the overlap row were the same hex. A four-step elevation scale (canvas → surface → card → inset) with "a container never reuses its parent's step", three radius tiers, and a single `Button` component plus an input-class helper so per-call-site styling can't drift again. Space Grotesk headings on Inter body; tabular numerals on every clock so live-ticking times don't shift the layout.
*   **[Implemented] Meeting Model**: Scheduled meetings with attendees, rendered on the grid — closing the loop the Overlap Finder used to leave open. Find the overlap, book it in place, see it drawn on every attendee's row. Scoped to create / view / delete, single occurrence, no invites, RSVPs, notifications, or calendar sync.

    Meetings carry **different timezone semantics from everything else here**, and that distinction is the feature's whole design. Standing hours are wall-clock-local ("9am wherever you are" is a different instant per person), while a meeting is one fixed instant reading as a different wall-clock time per attendee — so meetings store a UTC datetime, not the `HH:mm` strings used elsewhere. The two models never meet: meetings get their own conversion function rather than an extension of the wall-clock one, and exactly one place in the app (the booking form) turns a typed date and time into an instant. Cross-timezone and DST-boundary tests are mandatory here rather than thorough, because mixing the models is a bug that compiles, passes same-timezone tests, and is wrong only for other people.

    The grid shows one day on the **viewer's** clock, so a meeting is drawn at its hour on that clock in every attendee's row — one instant, one column, clamped to the day being displayed. A meeting in progress derives a **`meeting`** status ("In a meeting"), non-settable like `offline` and `break`, ranked above a standing lunch (a dated booking says which of the two is really happening) and below the heartbeat (a booking is a plan; a heartbeat is evidence). Any member can book a meeting they're attending; admins can book for anyone; only the organizer or an admin can delete.

## Known Issues / Technical Debt

The working list lives in `nextSteps.md` (canonical); the reasoning behind
everything already built lives in `docs/decisions.md`. Also tracked: timezone now having two writing surfaces (the member's own profile page and the admin card, deliberately — the admin path is the override for onboarding someone who has never logged in), the unverified self-or-admin check on the timezone route, the in-memory-only first-run gate dismissal, meeting carve-outs being distinguished from lunches by colour alone (both render identically apart from hue), the type scale still being per-component rather than tokenised, the status picker rolling back only when a write fails outright and not when the server refuses it, a timezone preview drawing meetings from a fetch scoped to the viewer's day rather than the previewed one, and the themed select popup being Chromium-only (it falls back to the native popup elsewhere, which hasn't been looked at).

## Testing

Unit tests for the pure scheduling/status functions are implemented (Vitest) — run `npm test` (watch) or `npm run test:run` (once) from `frontend/`. 139 tests spanning `scheduleTime.ts` (timezone conversion, overnight wraparound, DST-sensitive pairs, a cross-zone matrix, resolving each member's shift by their *own* weekday, and current on/off-shift state), the wall-clock-to-instant conversion that backs meeting booking, the date/time option builders in `timeOptions.ts`, the shared timezone list in `timezones.ts` (every offered zone valid per `Intl` and convertible via `dayjs.tz`), and the status precedence rules in `status.ts`.

The backend has its own Vitest suite (same commands, run from `backend/`) — 66 tests over the pure validation functions the API runs before it writes anything. `shiftValidation.ts` covers parsing `HH:mm` off the wire without coercing (a malformed time that becomes `NaN` compares false against every bound and would otherwise store as valid), measuring a shift's length forward so overnight shifts come out positive, the hour-only rule for shift boundaries against the quarter-hour rule for breaks, and break containment expressed as an offset from the shift's own start so a lunch crossing midnight stays legal. `meetingValidation.ts` covers the other side of the wall-clock/instant split: an explicit UTC offset normalizes to the same instant as `Z`, while a bare `2026-08-03T14:00` with no offset is rejected outright, since accepting it would mean guessing a timezone on the client's behalf. These deliberately stop at the routes — they touch no Express and no database.

Component tests were added on top of those (React Testing Library on jsdom, 11 tests, suite now 150). Deliberately four areas rather than coverage, because every bug this project has found in QA lived in the seam between React state and the network — which pure-function tests structurally cannot reach. They pin: the booking form converting on the viewer's own clock while a timezone preview is active, the schedule grid *following* that same preview (the two halves of the display/write split, which is a call-site invariant no unit test can see); the time picker joining its hour and minute halves back into `HH:mm` and refusing to emit an off-the-hour minute on a shift boundary; and a failed status write rolling the optimistic update back to the stored value rather than to `undefined`. Every one was verified by deliberately breaking the source and confirming the right test failed. What jsdom does *not* buy, since it has no rendering engine: layout, the sticky name column and the themed select popup all stay manual QA.

Remaining planned coverage — backend auth logic, and API route integration tests via Supertest (which first needs the app split out of `server.ts` and the native `bcrypt` import chain resolved) — is tracked in `nextSteps.md`.

## Project Directory Layout

```text
team_availability_dashboard/
├── backend/       # Express + TypeScript API, Mongoose models
├── frontend/      # React + Vite + TypeScript client
├── docs/
│   ├── decisions.md   # what landed and why - the reasoning trail
│   └── phases/        # per-phase handoff briefs
├── nextSteps.md   # working task tracker - what's NEXT only
└── README.md
```

## Developer Notes

This project is built with a human-in-the-loop workflow. Features are implemented with AI assistance working directly in the codebase, but every change is reviewed via `git diff` before it is committed, and all commits, dependency installs, and branch operations stay manual (GitHub Desktop / terminal). Architectural decisions and their rationale are recorded in `nextSteps.md` as they're made, so the "why" behind the code is traceable rather than lost in chat history.