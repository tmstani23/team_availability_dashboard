# Phase handoff docs

One file per remaining phase. Each is written to be pasted into a FRESH
session as the opening prompt — it assumes the agent has read `CLAUDE.md`
(auto-loaded) and nothing else about prior chats.

Run them in order. Each doc ends with a "log it" step that updates
`nextSteps.md`, so the next phase starts from an accurate tracker.

That "log it" step happens AFTER Tim has tested the phase, not at the end of
the build — see "Order of work" in `CLAUDE.md`. A phase doc's build section
finishing is the cue to hand over for testing, not to start writing the
`## COMPLETED` entry.

| Phase | File | Shape of the work |
|---|---|---|
| 0 | `phase-0-config-extraction.md` | Mechanical find-and-replace. No design decisions. |
| 1 | `phase-1-polling-heartbeat.md` | Design already settled; one genuine race to reason about. |
| 2 | `phase-2-recurring-lunch.md` | Contained model change, clear spec. |
| 3 | `phase-3-meetings.md` | A genuinely new timezone concept — settle the design before building. |

ALL FOUR PHASES ARE COMPLETE (0-2 on 8/2, 3 on 8/3). These docs are kept as
the briefs the work was built from; what actually landed, including where a
brief turned out to be wrong, is in `docs/decisions.md`.

Phase 3's doc puts its design questions before its build steps deliberately:
meetings store a UTC instant while everything else in the codebase stores
wall-clock strings, and mixing the two is a bug that compiles, passes tests,
and only shows up for people in another timezone.
