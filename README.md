# Distributed Team Availability Dashboard

A real-time workspace visualizer built to coordinate global engineering workflows across multiple time zones. This application eliminates manual time arithmetic by serving as a single source of truth for distributed team schedules, live availability statuses, and meeting windows.

## Goals & Design Constraints

The problem this solves: coordinating engineers across time zones normally means manual time-zone math, spreadsheet tracking, and constant "are they online right now?" messaging. This dashboard replaces all of that with one live, visual source of truth. Three constraints drive the design:

- **Zero manual math** — all UTC / time-zone conversion stays hidden behind the UI; a user only ever sees their own local clock.
- **High scannability** — a manager or teammate should be able to read someone's current availability in under two seconds.
- **Data accuracy across date boundaries** — shifts that cross midnight are handled correctly, and because this is a *presence* tool ("who is on shift right now?"), each member's current shift resolves against **their own local weekday**, not the viewer's. Near midnight two people can be on different weekdays; the grid shows each person's real current day, then converts the hours to the viewer's clock.

## Core Project Features

Status legend: Implemented / In Progress / Planned

*   **[Implemented] Global Schedule Matrix Grid**: An interactive daily timeline that visually plots individual team members' work shifts side-by-side.
*   **[Implemented] Automatic Context Time-Shifting**: Dynamically converts and renders all team schedules into the local time zone of the currently viewed user.
*   **[Implemented] Authentication & Role-Based Access**: JWT-based sessions stored in an httpOnly cookie, with `admin` / `member` roles gating routes on both the API (`authenticate` / `requireAdmin` middleware) and the frontend (`ProtectedRoute`, role-aware layouts). Covers login, logout, and admin-only actions (member management, role promotion, password reset).
*   **[Implemented] Live Availability Sidebar**: A real-time tracking panel showing each team member's current status, with a "viewer" selector to preview the dashboard as different team members. `TeamMember.status` is a four-value enum — `active` / `away` / `dnd` / `offline` — replacing the old `isAvailable` boolean. Members set their own status via a picker (active/away/dnd), keyed to real auth (`AuthContext.teamMemberId`). What a member *displays* as combines the schedule with what they set, in this order:

    1. **Off shift → `offline`** — derived, and it overrides whatever they set. A stored status is a snapshot of a moment someone clicked a button; "they are outside their own working hours right now" is a harder fact.
    2. **Otherwise → whatever they set.**
    3. **Never set anything → `away`.** The stored default is `away`, not `active`: `active` claims someone is present and available, which only the person can assert truthfully.

    `offline` is deliberately not hand-settable (rejected by the API and omitted from the picker) — it can only come from the schedule, so it never blurs with a manual choice. A member with no hours on file is *not* derived offline: that's an absence of information, not evidence they're off, and the UI labels it "Hours not set" instead.
*   **[Implemented] Meeting Overlap Finder**: A scheduling tool that scans selected team profiles and highlights the exact hours where everyone shares overlapping availability. Checkbox picker (`TeamHoursPanel`) drives an overlap row in `ScheduleGrid`, lit only where every selected member is active. Pure frontend against existing shift data — no model changes.
*   **[In Progress] Asynchronous Break Logging**: Quick-action controls allowing workers to log temporary absences. *(Data model supports an `isBreak` flag on shifts, but no UI control exists yet, and `ScheduleGrid` currently can't render a break and a standing shift on the same day for the same person — see Known Issues below. Design direction: breaks stay as separate, dated, one-off `WorkShift` records, distinct from the recurring shift described below.)*
*   **[Implemented] Recurring Weekly Hours**: Each person's normal working hours recur by day-of-week (e.g. "Monday: 9–5", "Friday: 9–1") rather than requiring the same shift every day. The grid still shows one day at a time; which shift displays resolves automatically from the member's own current weekday via `RecurringShift` records. No visual weekly view. Members set their own week at `/profile/hours` (admins can edit anyone's at `/members/:id/hours`) — seven weekday rows, each a time range or an "off" toggle, saved as one whole-week replace. New members start with no hours at all and are prompted to set them on first login; until they do, the UI distinguishes three states everywhere it matters — working, explicitly **off today**, and **hours not set** — since an empty row would otherwise read as "not working" when it means "we don't know yet".

## Technical Architecture

The application is structured as a full-stack system utilizing strict type-safety boundaries:

*   **[Implemented] Frontend**: React (Vite-powered) combined with TypeScript (`.tsx`) for strict component interface data definitions and predictable UI state.
*   **[Implemented] Backend Engine**: Express.js server logic built entirely in TypeScript, processing incoming payloads, middleware routing, and timezone normalization.
*   **[Implemented] Data Validation Layer**: Strict type-checking utilizing structural interfaces to eliminate data corruption across timezone offsets and scheduling arrays.
*   **[Implemented] Storage Layer**: MongoDB collections using indexed Mongoose schemas.
*   **[Implemented] Shift Data Model Rework**: Standing shifts now key off `dayOfWeek` (recurring, not date-bound) in a separate `RecurringShift` model, while one-off breaks keep a real `date` on `WorkShift`. The frontend reads recurring shifts through `scheduleTime.ts`, which resolves each member's current-weekday shift into three states (working / off / unset) and, from that, whether they're currently `on-shift` / `off-shift` / `unknown` on their own clock — the signal the derived-offline status runs on. Layering "today's break(s)" on top of the standing shift arrives with the break-logging UI — see `nextSteps.md`.
*   **[Planned] Live Sync**: WebSockets (Socket.io) to broadcast state transitions instantly to all active client sessions without manual browser reloads. *(Not yet implemented — the dashboard currently refetches data after each action rather than pushing live updates.)*

## Known Issues / Technical Debt

The working list lives in `nextSteps.md` (canonical). Current items include the lingering `viewerId` timezone-preview dependency, `ScheduleGrid` still resolving a single standing shift per member (breaks layered on the same day come with the break-logging UI), shift-time validation that currently lives only on the client, and deferred design polish.

## Testing

Unit tests for the pure scheduling/status functions are implemented (Vitest, node env) — run `npm test` (watch) or `npm run test:run` (once) from `frontend/`. Coverage spans `scheduleTime.ts` (timezone conversion, overnight wraparound, DST-sensitive pairs, resolving each member's shift by their *own* weekday, and current on/off-shift state) plus the status precedence rules in `status.ts`. Remaining planned coverage — backend auth (Jest), API routes (Supertest), and `ScheduleGrid` component tests (Vitest + React Testing Library) — is tracked in `nextSteps.md`.

## Project Directory Layout

```text
team_availability_dashboard/
├── backend/       # Express + TypeScript API, Mongoose models
├── frontend/      # React + Vite + TypeScript client
├── nextSteps.md   # working task tracker / decisions log
└── README.md
```

## Developer Notes

This project is built with a human-in-the-loop workflow. Features are implemented with AI assistance working directly in the codebase, but every change is reviewed via `git diff` before it is committed, and all commits, dependency installs, and branch operations stay manual (GitHub Desktop / terminal). Architectural decisions and their rationale are recorded in `nextSteps.md` as they're made, so the "why" behind the code is traceable rather than lost in chat history.