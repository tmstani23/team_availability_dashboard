# Phase 0 — config extraction

**This is mechanical.** No design decisions in it.

## Why this exists

Every fetch in the frontend hardcodes `http://localhost:5000`, and the CORS
origin in the backend hardcodes `http://localhost:5173`. Nothing can be
deployed until those come from config. It's pulled out of Phase 1 so the
polling diff stays readable rather than being buried in 14 unrelated
one-line changes.

## What to do

### Frontend

There are 14 occurrences of `http://localhost:5000` across 5 files:

- `src/context/AuthContext.tsx` (3)
- `src/context/TeamContext.tsx` (4)
- `src/components/AddTeamMemberForm.tsx` (1)
- `src/components/HoursEditor.tsx` (2)
- `src/components/TeamMemberCard.tsx` (4)

Replace all of them with a single exported constant. Create
`frontend/src/config.ts`:

```ts
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';
```

The fallback matters — it keeps `npm run dev` working with no `.env` file at
all, so this change is invisible in local development.

Then create `frontend/.env.example` documenting `VITE_API_URL`. Do NOT create
a real `.env` (Tim does that; it shouldn't be committed). Check
`frontend/.gitignore` already covers `.env` — add it if not.

Note for Vite: only variables prefixed `VITE_` are exposed to client code,
and `import.meta.env` is statically replaced at build time, not read at
runtime. That means the deployed build bakes in whatever `VITE_API_URL` was
set at build time — correct here, but worth knowing.

### Backend

In `backend/src/server.ts`, the CORS origin is hardcoded to
`http://localhost:5173`. Move it to `process.env.CORS_ORIGIN` with the same
literal as the fallback. Add it to `backend/.env.example` (create the file if
it doesn't exist, mirroring whatever keys `backend/.env` uses — read the
`process.env` references in the backend to find them, don't guess).

Leave `credentials: true` and the rest of the CORS config alone.

## Verify

- `npx tsc -b` clean in both `backend/` and `frontend/`
- `npm run lint` clean in `frontend/`
- Grep for `localhost:5000` and `localhost:5173` — the only remaining hits
  should be the two fallback defaults and the `.env.example` files
- Tell Tim to run both dev servers and confirm login still works. The auth
  cookie is the thing most likely to break silently if a URL is wrong.

## Log it

Add a `## COMPLETED — Phase 0: config extraction (date)` entry at the top of
`nextSteps.md`'s completed section, and remove the Phase 0 block from the
NEXT STEPS list. Note in it that `API_BASE` is now the single place the
backend URL lives, since Phase 1 adds new fetches and should use it.
