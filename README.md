# Distributed Team Availability Dashboard

A real-time workspace visualizer built to coordinate global engineering workflows across multiple time zones. This application eliminates manual time arithmetic by serving as a single source of truth for distributed team schedules, live availability statuses, and meeting windows.

## Goals & Design Constraints

The problem this solves: coordinating engineers across time zones normally means manual time-zone math, spreadsheet tracking, and constant "are they online right now?" messaging. This dashboard replaces all of that with one live, visual source of truth. Three constraints drive the design:

- **Zero manual math** — all UTC / time-zone conversion stays hidden behind the UI; a user only ever sees their own local clock.
- **High scannability** — a manager or teammate should be able to read someone's current availability in under two seconds.
- **Data accuracy across date boundaries** — the backend must correctly handle shifts that cross midnight into the viewer's next calendar day.

## Core Project Features

Status legend: Implemented / In Progress / Planned

*   **[Implemented] Global Schedule Matrix Grid**: An interactive daily timeline that visually plots individual team members' work shifts side-by-side.
*   **[Implemented] Automatic Context Time-Shifting**: Dynamically converts and renders all team schedules into the local time zone of the currently viewed user.
*   **[Implemented] Authentication & Role-Based Access**: JWT-based sessions stored in an httpOnly cookie, with `admin` / `member` roles gating routes on both the API (`authenticate` / `requireAdmin` middleware) and the frontend (`ProtectedRoute`, role-aware layouts). Covers login, logout, and admin-only actions (member management, role promotion, password reset).
*   **[In Progress] Live Availability Sidebar**: A real-time tracking panel showing each team member's current status, with a "viewer" selector to preview the dashboard as different team members. *(`TeamMember.status` is now a four-value enum — `active` / `away` / `dnd` / `offline` (default `active`) — replacing the old `isAvailable` boolean. Members set their own status via a picker (active/away/dnd); status editing is keyed to real auth (`AuthContext.teamMemberId`). `offline` is not hand-settable: it will be derived automatically from a member's schedule (offline when they're off-shift at their own local time), which depends on the Shift Data Model Rework below and lands with it.)*
*   **[Implemented] Meeting Overlap Finder**: A scheduling tool that scans selected team profiles and highlights the exact hours where everyone shares overlapping availability. Checkbox picker (`TeamHoursPanel`) drives an overlap row in `ScheduleGrid`, lit only where every selected member is active. Pure frontend against existing shift data — no model changes.
*   **[In Progress] Asynchronous Break Logging**: Quick-action controls allowing workers to log temporary absences. *(Data model supports an `isBreak` flag on shifts, but no UI control exists yet, and `ScheduleGrid` currently can't render a break and a standing shift on the same day for the same person — see Known Issues below. Design direction: breaks stay as separate, dated, one-off `WorkShift` records, distinct from the recurring shift described below.)*
*   **[In Progress] Recurring Weekly Hours**: Each person's normal working hours will recur by day-of-week (e.g. "Monday: 9–5", "Friday: 9–1") rather than requiring the same shift every day. *(Design decision made, not yet implemented. This does not include a visual weekly view — the grid will keep showing one day at a time, and which shift displays resolves automatically based on the current day of week. Currently a member's shift is a single date-based record set once at creation time.)*

## Technical Architecture

The application is structured as a full-stack system utilizing strict type-safety boundaries:

*   **[Implemented] Frontend**: React (Vite-powered) combined with TypeScript (`.tsx`) for strict component interface data definitions and predictable UI state.
*   **[Implemented] Backend Engine**: Express.js server logic built entirely in TypeScript, processing incoming payloads, middleware routing, and timezone normalization.
*   **[Implemented] Data Validation Layer**: Strict type-checking utilizing structural interfaces to eliminate data corruption across timezone offsets and scheduling arrays.
*   **[Implemented] Storage Layer**: MongoDB collections using indexed Mongoose schemas.
*   **[Planned] Shift Data Model Rework**: `WorkShift` currently keys standing shifts off a calendar `date`. Planned change: standing shifts key off `dayOfWeek` instead (recurring, not date-bound), while breaks keep a real `date` since they're inherently one-off events. This is a schema-level fork, not just a UI change — `ScheduleGrid`'s shift lookup will need to resolve "today's recurring shift" and "today's break(s), if any" as two separate lookups instead of one.
*   **[Planned] Live Sync**: WebSockets (Socket.io) to broadcast state transitions instantly to all active client sessions without manual browser reloads. *(Not yet implemented — the dashboard currently refetches data after each action rather than pushing live updates.)*

## Known Issues / Technical Debt

The working list lives in `nextSteps.md` (canonical). Current items include the lingering `viewerId` timezone-preview dependency, `ScheduleGrid` resolving only one shift per member, and deferred design polish.

## Testing

Unit tests for `scheduleTime.ts`'s pure functions are implemented (Vitest, node env) — run `npm test` (watch) or `npm run test:run` (once) from `frontend/`. Remaining planned coverage — backend auth (Jest), API routes (Supertest), and `ScheduleGrid` component tests (Vitest + React Testing Library) — is tracked in `nextSteps.md`.

## Project Directory Layout

```text
team_availability_dashboard/
├── backend/       # Express + TypeScript API, Mongoose models
├── frontend/      # React + Vite + TypeScript client
├── nextSteps.md   # working task tracker / decisions log
└── README.md
```

## Developer Notes

This project is built manually using a "Human-in-the-Loop" development process. To maintain system security and full structural control, all local code modification, dependency installation, and directory creation are handled manually inside Visual Studio Code. Artificial intelligence is utilized strictly for non-autonomous architectural advice, syntax mentoring, and isolated structural task breakdowns.