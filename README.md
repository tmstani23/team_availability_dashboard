# Distributed Team Availability Dashboard

A production-grade, real-time workspace visualizer built to coordinate global engineering workflows across multiple time zones. This application eliminates manual time arithmetic by serving as a single source of truth for distributed team schedules, live availability statuses, and meeting windows.

## Core Project Features

*   **Global Schedule Matrix Grid**: An interactive daily timeline that visually plots individual team members' work shifts side-by-side.
*   **Automatic Context Time-Shifting**: Dynamically converts and renders all team schedules into the local time zone of the currently logged-in user.
*   **Live Availability Sidebar**: A real-time tracking panel showing immediate employee working states (`Active`, `Away`, `Do Not Disturb`, `Offline`).
*   **Meeting Overlap Finder**: A scheduling tool that scans selected team profiles and highlights the exact hours where everyone shares overlapping availability.
*   **Asynchronous Break Logging**: Quick-action controls allowing workers to log temporary absences, instantly updating the collective team dashboard state.

## Technical Architecture

The application is structured as a full-stack system utilizing strict type-safety boundaries and real-time state synchronization:

*   **Frontend**: React (Vite-powered) combined with TypeScript (`.tsx`) for strict component interface data definitions and predictable UI state.
*   **Backend Engine**: Express.js server logic built entirely in TypeScript, processing incoming payloads, middleware routing, and timezone normalization.
*   **Data Validation Layer**: Strict type-checking utilizing structural interfaces to eliminate data corruption across timezone offsets and scheduling arrays.
*   **Storage Layer**: MongoDB collections using indexed Mongoose schemas to store standardized Coordinated Universal Time (UTC) formats.
*   **Live Synch**: WebSockets (Socket.io) to broadcast state transitions instantly to all active client sessions without manual browser reloads.

## Project Directory Layout

```text
team-availability-dashboard/
├── client/                 # React Frontend Application (Vite + TypeScript)
│   ├── src/
│   │   ├── components/     # Reusable UI elements (Timeline, Sidebar, Grid)
│   │   ├── hooks/          # Custom timezone management and data fetching
│   │   └── types/          # Shared frontend TypeScript interfaces
├── server/                 # Express Backend Application (Node + TypeScript)
│   ├── src/
│   │   ├── controllers/    # Request handlers for users and schedules
│   │   ├── middleware/     # Validation, time normalization, and security
│   │   ├── models/         # TypeScript-bound Mongoose models
│   │   └── types/          # Strict backend payload blueprints
└── README.md
```

## Developer Notes

This project is built manually using a "Human-in-the-Loop" development process. To maintain system security and full structural control, all local code modification, dependency installation, and directory creation are handled manually inside Visual Studio Code. Artificial intelligence is utilized strictly for non-autonomous architectural advice, syntax mentoring, and isolated structural task breakdowns.
