# Distributed Team Availability Dashboard

A real-time workspace visualizer built to coordinate global engineering workflows across multiple time zones. This application eliminates manual time arithmetic by serving as a single source of truth for distributed team schedules, live availability statuses, and meeting windows.

## Core Project Features

Status legend: Implemented / In Progress / Planned

*   **[Implemented] Global Schedule Matrix Grid**: An interactive daily timeline that visually plots individual team members' work shifts side-by-side.
*   **[Implemented] Automatic Context Time-Shifting**: Dynamically converts and renders all team schedules into the local time zone of the currently viewed user.
*   **[Implemented] Authentication & Role-Based Access**: JWT-based sessions stored in an httpOnly cookie, with `admin` / `member` roles gating routes on both the API (`authenticate` / `requireAdmin` middleware) and the frontend (`ProtectedRoute`, role-aware layouts). Covers login, logout, and admin-only actions (member management, role promotion, password reset).
*   **[In Progress] Live Availability Sidebar**: A real-time tracking panel showing each team member's current status, with a "viewer" selector to preview the dashboard as different team members. *(Currently a binary `Available` / `Away` toggle backed by `TeamMember.isAvailable: Boolean`. PRD calls for a fuller state set — Active, Away, Do Not Disturb, Offline — which isn't modeled yet; would need `isAvailable` replaced with a status enum.)*
*   **[Planned] Meeting Overlap Finder**: A scheduling tool that scans selected team profiles and highlights the exact hours where everyone shares overlapping availability. *(Not yet started. Pure frontend logic against existing shift data — no model changes required.)*
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

*   **Two sources of "who am I".** `TeamStatusSidebar`'s "Simulating Active User" dropdown (`TeamContext.viewerId`) predates real authentication and is now disconnected from it — the app has both a real logged-in identity (`AuthContext.teamMemberId`) and a leftover manual viewer picker. Not yet reconciled.
*   **`ScheduleGrid` only renders one shift per member.** Its shift lookup grabs the first matching `WorkShift` record and stops — no date filtering, no handling of multiple shifts. This has been invisible so far because each member has only ever had one shift record. It will surface as soon as either break logging or day-of-week recurrence lands, since both introduce a second shift-like record per member per day.
*   **`AddTeamMemberForm` contrast issue.** Form inputs use the same background color as the card they sit on (`bg-zinc-800` on `bg-zinc-800`), relying on border alone for separation. Deferred to a broader design pass.
*   **No visual polish pass yet.** Button colors and general card styling are functional but not deliberately designed; deferred until core features (break logging, overlap finder, recurring shifts) are further along.

## Testing

Status legend: Implemented / In Progress / Planned

- Planned: Backend unit tests (Jest) for auth logic — password hashing,
  JWT verification, role-gated middleware — since this is the highest-risk
  code in the project.
- Planned: Integration tests for API routes (team-members, work-shifts, auth)
  using Supertest.
- Planned: Frontend component tests (Vitest + React Testing Library) for
  ScheduleGrid's timezone conversion logic, given its complexity and how
  easy it is to silently break (see: the 09:00–09:05 shift bug caught during
  manual QA).
- Not planned at this scope: E2E testing (Playwright/Cypress) — would be a
  reasonable next step if this grows beyond a portfolio project.

## Project Directory Layout

```text
team_availability_dashboard/
├── backend/    # Express + TypeScript API, Mongoose models
├── frontend/   # React + Vite + TypeScript client
├── project_goals.md
└── README.md
```

## Developer Notes

This project is built manually using a "Human-in-the-Loop" development process. To maintain system security and full structural control, all local code modification, dependency installation, and directory creation are handled manually inside Visual Studio Code. Artificial intelligence is utilized strictly for non-autonomous architectural advice, syntax mentoring, and isolated structural task breakdowns.