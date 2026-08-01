# Phase handoff docs

One file per remaining phase. Each is written to be pasted into a FRESH
session as the opening prompt — it assumes the agent has read `CLAUDE.md`
(auto-loaded) and nothing else about prior chats.

Run them in order. Each doc ends with a "log it" step that updates
`nextSteps.md`, so the next phase starts from an accurate tracker.

| Phase | File | Suggested model | Why |
|---|---|---|---|
| 0 | `phase-0-config-extraction.md` | Sonnet, low effort | Mechanical find-and-replace. No design decisions. |
| 1 | `phase-1-polling-heartbeat.md` | Sonnet, medium | Real design already settled; one genuine race to reason about. |
| 2 | `phase-2-recurring-lunch.md` | Sonnet, medium | Contained model change, clear spec. |
| 3 | `phase-3-meetings.md` | Opus for the design pass, then Sonnet medium to build | New timezone concept — the one place a cheap model can quietly get it wrong. |

Phase 3's doc is split into a design step and a build step for that reason.
Don't merge them into one session.
