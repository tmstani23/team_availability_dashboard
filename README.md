# Distributed Team Availability Dashboard

A production-grade, real-time workspace visualizer built to coordinate global engineering workflows across multiple time zones. This application eliminates manual time arithmetic by serving as a single source of truth for distributed team schedules, live availability statuses, and meeting windows.

## Core Project Features

Status legend: ✅ Implemented · 🚧 In Progress · 📋 Planned

*   ✅ **Global Schedule Matrix Grid**: An interactive daily timeline that visually plots individual team members' work shifts side-by-side.
*   ✅ **Automatic Context Time-Shifting**: Dynamically converts and renders all team schedules into the local time zone of the currently viewed user.
*   ✅ **Live Availability Sidebar**: A real-time tracking panel showing each team member's current status (`Available` / `Away`), with a "viewer" selector to preview the dashboard as different team members.
*   📋 **Meeting Overlap Finder**: A scheduling tool that scans selected team profiles and highlights the exact hours where everyone shares overlapping availability. *(Not yet started.)*
*   🚧 **Asynchronous Break Logging**: Quick-action controls allowing workers to log temporary absences. *(Data model supports an `isBreak` flag on shifts; no UI control exists yet to log a break from the dashboard.)*
*   🚧 **Profile / Weekly Hours**: A place where each person sets their normal recurring schedule (e.g. Mon–Fri 9–5 in their timezone), with today's shifts generated automatically from that pattern plus any one-off overrides. *(Currently a member's initial shift is set once at creation time; recurring weekly patterns and overrides are not yet implemented.)*

## Technical Architecture

The application is structured as a full-stack system utilizing strict type-safety boundaries:

*   ✅ **Frontend**: React (Vite-powered) combined with TypeScript (`.tsx`) for strict component interface data definitions and predictable UI state.
*   ✅ **Backend Engine**: Express.js server logic built entirely in TypeScript, processing incoming payloads, middleware routing, and timezone normalization.
*   ✅ **Data Validation Layer**: Strict type-checking utilizing structural interfaces to eliminate data corruption across timezone offsets and scheduling arrays.
*   ✅ **Storage Layer**: MongoDB collections using indexed Mongoose schemas.
*   📋 **Live Synch**: WebSockets (Socket.io) to broadcast state transitions instantly to all active client sessions without manual browser reloads. *(Not yet implemented — the dashboard currently refetches data after each action rather than pushing live updates.)*
*   📋 **Authentication**: There is currently no real login/auth system — the "current user" is simulated via a dropdown selector in the sidebar rather than backed by a session or account.

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