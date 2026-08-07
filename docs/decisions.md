# Decisions log

Everything that has already landed, and the reasoning behind it. Split out of
`nextSteps.md` on 8/7 - that file had grown past 1200 lines and the finished
work was burying the actionable work. Nothing here was rewritten in the move;
entries are verbatim, newest first.

`nextSteps.md` stays canonical for what's NEXT: the roadmap, known issues, and
the deployment checklist. This file is where you look to find out why
something is the way it is.

Two kinds of entry, deliberately kept together rather than in separate files:

- `## COMPLETED — ...` — what landed in a given session, and what QA it passed.
- `### DECISION: ...` — a design settled before the build it belongs to.
  These sit next to the COMPLETED entry they produced, since reading either
  one alone tends to raise the question the other answers.

The older `## DECISIONS MADE, NOT YET IMPLEMENTED` section at the bottom is a
historical heading, not a live one - every item under it is now marked
IMPLEMENTED or SUPERSEDED. It's kept for the reasoning trail: a superseded
decision usually got that way because the FEATURE changed, and that's worth
being able to tell apart from a decision that was simply wrong.

---

## COMPLETED — Retire viewerId (8/7)
The last pre-auth leftover. Not a deletion: `viewerId` owned the grid's ONLY
timezone source, so this was a replacement, and the test of whether it was a
clean one was whether the two consumers downstream (ScheduleGrid,
TeamHoursPanel) needed edits. They didn't - only their labels and comments did.

`viewerTimezone` now resolves browser -> logged-in member's stored zone ->
`'UTC'`. `viewerId` / `setViewer` / `viewerMember` are gone from TeamContext
and TeamContextType. The "Simulating Active User" dropdown is replaced by a
static identity block: initials avatar, name, live clock, zone.

The browser lookup is module-level (`BROWSER_TIMEZONE`), since the OS zone
can't change while the tab is open and re-deriving per render could only ever
produce the same answer. Accepted consequence: someone who changes their OS
zone mid-session sees a stale grid until reload.

Added `browserTimezone` to the context alongside `viewerTimezone`, for one
narrow reason - it's what lets the UI say "(this device)" honestly. When the
two are equal the browser won; when they differ a fallback did, and captioning
that as the device's zone would be a lie.

Two latent oddities died with the dropdown. The old fallback was
`members.find(...) || members[0]`, so before you ever touched the picker the
grid rendered in whatever zone the FIRST MEMBER IN THE API RESPONSE happened to
have - not yours, not anyone's deliberately. And the `[viewerTimezone]` refetch
dep, which existed because switching the dropdown changed the meetings window,
now fires at most once (the browser zone is known synchronously on first
render). Kept anyway: the fallback chain can still resolve twice if
`BROWSER_TIMEZONE` is null.

### DECISION: mismatch is NAMED, not linked (8/7)
The design called for "Profile says Chicago — update?" linking to the profile
page. Building it surfaced that THERE IS NO SELF-SERVICE TIMEZONE EDITOR -
`timezone` is only editable by an admin from TeamMemberCard on `/admin/manage`,
and `/profile/hours` never touches it. So the link had nowhere honest to point.

Chose: show the mismatch, no link, wording role-aware ("ask an admin to update
it" / "update it in Manage"). Rejected adding a self-service timezone field,
which is a real feature - changing your stored zone changes when teammates see
you as working - and deserves its own decision rather than a drive-by.

Note for anyone revisiting: for a MEMBER, a link would have changed nothing.
They can't edit their own zone either way. The link would only ever have been
useful to admins.

`(this device)` is shown ONLY alongside a mismatch. It's a contrast - it makes
the amber line read as two different facts rather than a contradiction - and
with nothing to contrast against it answers a question nobody asked, while
being the sole cause of the line overflowing its column.

VERIFIED 8/7 (Tim, browser QA): identity block renders with and without a
mismatch; a chillguy/Sydney profile against a Chicago device showed the amber
line while the grid correctly stayed on Chicago; roster rows continue to show
each member's own stored zone. `tsc --noEmit` and `eslint` clean on all touched
files.

KNOWN, NOT FROM THIS WORK: `npm run lint` reports one pre-existing error in
`Button.tsx` (`buttonClasses` exported alongside a component trips
`react-refresh/only-export-components`), introduced by the 8/7 design pass.

### DECISION: viewer timezone source (8/7)
Settled the open question left over from the 8/3 plan: what happens when the
logged-in member's STORED timezone disagrees with the BROWSER's.

ANSWER: the browser wins for viewing, the stored zone stays the schedule
identity and is never auto-synced, and the identity block NAMES the
disagreement instead of hiding or arbitrating it.

THE REFRAME that produced this: "the viewer's timezone" is two different
fields that got conflated, and when they disagree both are correct about
different things.
- STORED zone = schedule identity. It resolves the member's standing 9-5 and
  it's what every OTHER person's screen uses to decide whether they're on
  shift. If this followed the browser, flying to Tokyo would silently retime
  a member's working hours for the whole team - their "9-5" becomes 9-5 Tokyo
  and colleagues see them on shift in the middle of their night. Travel must
  not rewrite a schedule.
- BROWSER zone = the clock on the viewer's wall right now. That's what the
  grid needs, since converting other people's hours onto the clock you're
  actually reading is the grid's entire job.

WHY BROWSER WINS FOR VIEWING - the same principle the heartbeat already
established: evidence beats a stale claim. The OS knows where the machine is;
the stored zone is something someone typed once, possibly an admin, possibly
months ago. Phase 1 decided a live heartbeat outranks a stored status for
exactly this reason, and this is that argument in a different costume.

CONSEQUENCE FOR MeetingPanel, which the original open question missed:
`viewerTimezone` is also the input to the one place a wall clock becomes an
instant (`dayjs.tz(date + time, viewerTimezone)`). If someone in Tokyo reads a
Tokyo-labelled grid and books "2pm," they mean 2pm Tokyo - otherwise the
meeting lands in a different column from the one they clicked. The grid and
the booking form MUST share one value, and it has to be the zone the grid is
visibly labelled with. This makes browser-wins not just preferable but forced.

REJECTED - prompt the viewer to choose (the first instinct, and the trip case
behind it is real). Three problems. The answer needs somewhere to live, and
in-memory means re-asking on every reload - the FirstRunHoursGate known issue
repeating itself - while localStorage or a new field is real persistence
machinery for a preference set once and forgotten. It's also a modal on a
dashboard whose stated constraint is reading availability in under two
seconds. Worst, it frames the disagreement as a CHOICE when it's usually a
DEFECT: a stale record after a move, an admin's typo at member creation, a
machine with a misconfigured OS clock. "Use browser this time" fixes nothing,
so it asks forever.

REJECTED - browser wins silently. Simpler, but a stale stored record then
never surfaces to the one person who can correct it, and a wrong stored zone
misreports that member's shift to everyone else indefinitely.

REJECTED - stored wins (the original 2a). Consistent with how every other
member's hours resolve, but it makes the grid wrong precisely while
travelling, which is when cross-timezone reading matters most.

IMPLEMENTATION NOTE: compare IANA zone STRINGS, never offsets. Two different
zones can share an offset, and one zone changes its own offset twice a year -
an offset comparison would flash a false "disagreement" at every DST
changeover.

## COMPLETED — Design pass: visual system (8/7)
Scoped as "button colors and card polish." Became a real design system, because
the first look at the palette found that violet was the primary button colour
AND the overlap-row colour at the same hex (#7c3aed both), which isn't a taste
problem to polish - it's the palette telling two stories with one value.

VERIFIED 8/7 (Tim, browser QA + `npm run lint` + `npm run test:run` on Windows):
every surface swept - login, dashboard, admin Schedule + Manage, /profile/hours,
/members/:id/hours, first-run gate, TeamMemberCard expanded.

### DECISION: chrome and data never share a hue
The rule the whole system hangs on, and the one that makes the original
collision structurally impossible rather than merely fixed:
- BRAND (violet) means "you can interact with this" - buttons, links, focus
  rings, selection, native control accents. Nothing else.
- SCHEDULE colours (sage / rose / carve) mean what's on the calendar. They
  appear in the grid and in the status pill describing the same fact, and never
  on a control.
Everything below follows from it. Without the rule, the next feature that needs
a colour re-creates the same problem somewhere else.

PALETTE - slate neutrals, violet-pushed accent, sage shifts, rose meetings.
- Arrived at by looking at real references rather than picking hues: Radix's
  12-step scale (each step has an assigned job - 1-2 app background, 3-5
  component fills, 6-8 borders, 9-10 solid fills, 11-12 text) is the skeleton,
  since "no stated job per step" is exactly why zinc-700/800/900 got chosen by
  feel. The 2026 dark-dashboard pattern of ONE saturated accent against
  desaturated neutrals doesn't transfer directly here - this app has six status
  colours plus four grid fills - which is what forced the chrome/data split
  above rather than a single-accent scheme.
- THE ACCENT IS TUNED TO THE BASE, not chosen in isolation. Straight periwinkle
  on blue-grey neutrals reads as "the background, but brighter" - only ~20° of
  hue separation. Pushed to #7c74f2 (violet-ward) it separates. Had the base
  been the aubergine option, the correct move was the opposite direction.
- ROSE WAS PICKED AGAINST SAGE, NOT AGAINST THE CHROME. Meetings draw INSIDE
  on-shift blocks, so booked-on-shift is the pair a reader has to separate.
  An earlier cut used sky, which satisfied "not violet" while sitting near the
  then-emerald shift colour - a chrome collision traded for a data one. Warm
  rose against cool sage separates on hue, value and temperature at once, and
  survives red-green colour blindness where two greens or a green/cyan pair
  would not.
- `--color-ok` is deliberately the SAME VALUE as `--color-shift`. The Active
  pill and the on-shift grid block are two renderings of one fact and were
  previously two different greens.
- `dnd` keeps a conventional red - the one status where convention beats
  palette cohesion, since a warning that blends in isn't a warning. Pulled
  slightly orange-ward to hold apart from `booked` rose, the nearest hue and
  the only pill it can sit beside.
- Text tokens (`ink` / `ink-muted` / `ink-faint`) are slate-tinted. Plain zinc
  greys read faintly brown against a blue-grey base - a mismatch that's
  noticeable without being nameable.

TOKENS - `@theme` in index.css. NOTE FOR ANYONE COMING FROM TAILWIND v3: v4
keeps theme config in CSS, and `tailwind.config.js` was a v3-style config that
v4 IGNORED entirely (no `@config` directive in the stylesheet), so it had been
dead the whole time. Deleted by hand 8/7.

DELETE BUTTONS GO QUIET. Six solid red fills made Delete the loudest thing on a
Manage page that's otherwise read-only information - the eye reached "Delete"
before it reached any member's name. Colour still carries the warning, only the
weight drops. If a confirm step is ever added, the solid fill belongs THERE:
loud at the moment of consequence, not at rest.

NATIVE CONTROLS - `accent-color` set once on `:root`. This was the actual cause
of the Windows-blue Lunch checkboxes: TeamHoursPanel carried `accent-violet-500`
on its own checkbox and HoursEditor never got it. One inherited rule instead of
a class to remember per control, which is the same reasoning as Button below.
Date/time picker glyphs get a filter so they're visible against the inputs.

TYPE - Space Grotesk headings, Inter body. There was NO font stack set at all
before this; the app was falling through to the browser default. Applied via a
bare `h1-h4` rule so no component has to remember a font class. Inter keeps the
body AND the grid deliberately - Space Grotesk's wider forms cost horizontal
room, and the grid is the most space-constrained surface here. Fonts are
`<link>`ed in index.html rather than `@import`ed in CSS, since an @import can't
be discovered until the stylesheet it lives in has parsed.

`Button.tsx` + `utils/ui.ts` - one definition each for buttons and fields.
Before this every call site restated its own class string and they HAD drifted:
LoginForm and AddTeamMemberForm had `active:` states, HoursEditor and
TeamMemberCard didn't; some had disabled styling and some didn't; padding came
in three sizes with no rule behind which went where. Same argument as
STATUS_META and scheduleTime.ts. `buttonClasses()` is exported separately
because three call sites are `<Link>`s that must look identical - without it
they'd go straight back to hand-copying. Inputs got a class helper rather than
a component, since input/select/textarea don't share a props shape.

ELEVATION - four steps (canvas / surface / card / inset) with the rule that a
container never reuses its parent's step. That found THREE same-background
collisions, not the one on the known-issues list: MeetingPanel on ScheduleView's
main column, plus its own list rows and attendee chips, which would have
collided the moment the panel stepped up. TeamMemberCard's badge panel steps
DOWN to inset. Radius collapsed to controls `md` / cards `xl` / pills `full`,
retiring 32 bare `rounded` uses.

FIXES FOUND ALONG THE WAY:
- STATUS PILL WRAPPED onto two lines for long labels ("In a meeting") next to
  long names. Not a sizing tweak: a flex child's default `min-width: auto` means
  it won't shrink below its content, so the PILL was what gave way. `min-w-0`
  plus `truncate` on the name column and `whitespace-nowrap shrink-0` on the
  pill makes the name clip instead - the right one to sacrifice, since a
  clipped name is still recognisable and a wrapped pill just looks broken.
- TABULAR NUMERALS (`.tnum`) on every clock, hour label and shift range.
  Proportional digits make `1` narrower than `0`, so a live-ticking clock
  shifts sideways as the minute rolls; on a roster of them that reads as the
  layout twitching.
- TeamMemberCard's clock was still calling `dayjs()` at render, so it froze at
  first paint instead of ticking with the poll. Same fix HoursEditor got 8/2 and
  the sidebar got earlier the same day. That's three components that each had to
  learn this separately, which suggests `now`-from-context deserves to be the
  documented default rather than a repeated correction.
- index.html still had `<title>frontend</title>`.

VERIFICATION NOTE worth reusing: `tsc` proves nothing about Tailwind classes -
an unknown utility is silently omitted, not an error, so a typo'd token name
compiles clean and just doesn't paint. `vite build` can't run in the sandbox
(rolldown native bindings, same blocker as Vitest), so the check was
`npx @tailwindcss/cli -i src/index.css -o /tmp/out.css` and grepping the output
for each new utility INCLUDING the prefixed forms (`.hover\:border-line-strong`,
`.focus-visible\:ring-brand-hover\/60`), which is where a bad token would fail
quietly.

REJECTED - monochrome chrome (near-white buttons, colour reserved entirely for
data). Structurally the strongest answer and the current Vercel/shadcn pattern,
but it reads stark and drops the brand identity, and this is a portfolio piece
where that costs something real.
REJECTED - moving meetings to cyan, then to sky. See the rose reasoning above.
REJECTED - blue as the interactive colour. It collided with the existing
`border-blue-500` "you" marker in the sidebar, and the marker's meaning is
already carried in words by the "(You)" label - but the deeper problem was that
blue-as-action never addressed why the palette had no rule in the first place.

## COMPLETED — Doc split + sidebar timezone label (8/7)
Chunk 1 of the order agreed 8/3. Two unrelated small things paired to make one
session worth opening; neither depended on the other.

VERIFIED 8/7 (Tim): `npm run lint` clean and `npm run test:run` green on
Windows under real Vitest, roster rows reading "10:41 AM · City" in the
browser.

THE SPLIT — this file is new. Every `## COMPLETED` entry and every
`### DECISION:` block moved out of `nextSteps.md` VERBATIM; nothing was
rewritten, condensed, or re-dated in the move. `nextSteps.md` went 1298 -> ~180
lines and now holds only START HERE, the roadmap, known issues, and the
deployment checklist.
- Verified lossless mechanically rather than by reading: the three slices
  (nextSteps head + this file's body + nextSteps tail) were concatenated and
  diffed against `HEAD:nextSteps.md`. The only differences were the
  uncommitted 8/3 doc churn and the deletions listed below. Worth repeating
  the trick on any future move of this kind - a 1000-line copy/paste is
  exactly the operation where a silent truncation goes unnoticed for weeks.
- DELETED as newly false rather than moved: the paragraph saying "this file is
  now ~1100 lines and splitting it is still worth doing," and the at-a-glance
  PHASE 1/2/3 summaries plus the PHASE 3 ADDON brief in the NEXT STEPS
  section. Those summaries described finished work; leaving them would have
  reproduced the exact problem the split was for, one section lower down.
- The remaining roadmap items renumbered 4/5 -> 1/2 and became `###` headings
  instead of list items, so their sub-steps stop being 4-space-indented
  (which markdown reads as a code block once they're no longer inside a
  numbered list).
- Kept in one file rather than splitting decisions from completions: reading
  either alone tends to raise the question the other answers.

THE LABEL — `formatTimezoneLabel` in `scheduleTime.ts`, and
`TeamStatusSidebar` roster rows now read "10:41 AM · Sydney".
- DERIVED from `TeamMember.timezone`, never stored. A second field would be
  one more thing to keep in sync for no gain; the IANA string already contains
  the city.
- Takes the LAST '/' segment, not the second. "America/Argentina/Buenos_Aires"
  and "America/Indiana/Indianapolis" are the cases that make the difference -
  index 1 yields "Argentina" and "Indiana", which are not cities and read as a
  bug on screen. Zones with no slash (UTC, GMT) pass through.
- Returns '' for missing/blank/trailing-slash input, and the sidebar drops the
  label entirely in that case. This matters more than it looks: the invalid-tz
  path falls back to the BROWSER's clock, so the time on screen is then the
  viewer's own, and tagging it with the member's intended city would
  confidently mislabel a wrong number. Silence is the honest output.
- `getLocalTime` switched from `dayjs()` to TeamContext's ticking `now`. It
  was already updating, but only because an unrelated changing `now`
  re-rendered the component - an accident of a neighbouring dependency, not a
  dependency. Same fix HoursEditor got on 8/2.
- NOT applied to TeamMemberCard, which shows the same bare clock: it already
  prints the full IANA zone two lines above, so the clock there isn't
  ambiguous and the label would be duplication.
- Tests: 13 new cases in `scheduleTime.test.ts` (two- and three-segment zones,
  underscores, no-slash passthrough, and the five empty-string paths).
  Vitest still can't run in the sandbox, so these were checked via an esbuild
  compiled-JS harness; harness verified by deliberately breaking an assertion
  and confirming it reported the failure and exited non-zero.
- `npx tsc -b` clean in frontend, `npx tsc --noEmit` clean in backend.

FOR THE NEXT CHUNK: step 2d (the identity block replacing the viewerId
dropdown) now has its format decided and shipped - it calls
`formatTimezoneLabel` and reads the clock from `now`. `getLocalTime` in
TeamStatusSidebar is the shape to copy.

## COMPLETED — Phase 3: meeting model (8/3)
Built on the decisions immediately below, which were settled first and not
revised during the build. Create / view / delete, single occurrence; the scope
edge held.

VERIFIED 8/3 (Tim, manual QA): meeting drawing on every attendee's row and
the "In a meeting" pill; the SAME meeting moving from the 17:00 column
(Chicago) to 07:00 (Tokyo) when the viewer switches - and landing on Tokyo's
NEXT calendar day, which is the cross-day rule rather than a rounding
accident; the overlap row dark at both 12:00 (lunch) and 17:00 (meeting),
i.e. both exclusion paths at once; a meeting nested inside a full-hour lunch
drawing violet-inside-grey; delete refreshing the grid; and cross-session
status propagation still working in a second incognito profile (the main
regression risk from the refetch fix below). `npm run lint` clean and
`npm run test:run` green on Windows under real Vitest.

- Model `backend/src/models/Meeting.ts`: title, `startsAt`/`endsAt` as Date
  (UTC instants), `attendeeIds` refs, `createdBy`, index on `startsAt`.
  Mirrored by hand into both type files, with the instant-vs-wall-clock note
  restated in each because that's where someone will look first.
- `backend/src/utils/meetingValidation.ts`: title, duration (15min-12h),
  attendee ids. `parseInstant` REJECTS a bare "2026-08-03 14:00" - a string
  with no offset names a wall clock, not an instant, and guessing a zone for
  it is precisely the bug this phase is about. It also accepts any offset,
  not just Z, since an instant is an instant however it was written.
  Deliberately shares no code with shiftValidation.ts: there's no
  "on the hour" rule and no wrap-past-midnight case here, because an instant
  is just a number and "before" means before.
- Routes `/api/meetings`: GET by range (any authed user, interval-OVERLAP
  test not "starts inside", so a meeting running in from yesterday still
  appears), POST, DELETE. Mounted in server.ts.
- NEW `resolveMeetingCarveOutInViewerTz` in scheduleTime.ts, plus
  `viewerDayWindow`, `isMeetingInProgress`, `meetingsForMember`. Kept behind a
  banner comment separating the instant functions from the wall-clock ones.
  THE ASYMMETRY WORTH REMEMBERING: resolveHourRangeInViewerTz MUST anchor to
  today (its input carries no date, so there's no offset to use otherwise);
  the meeting one MUST NOT (its input carries its own date, and dayjs applies
  that date's offset on .tz() automatically). Same-looking conversions,
  opposite requirements.
- CLAMPED to the viewer's local day, which was not in the plan and turned out
  to remove a whole class of edge case. The grid's columns are hour-of-day, so
  an unclamped meeting spilling over midnight would paint cells belonging to a
  different day. A useful consequence: a clamped carve-out never wraps, so
  isOvernight is always false for meetings, and the fiddly two-segment
  overnight path only breaks ever apply to lunches.
  A meeting ending exactly at local midnight reports endHour 24, not 0 -
  otherwise it collapses to zero width and the last hour draws as free.
- `ScheduleCell` took the two changes predicted in the decision block, both
  real rather than free inherits: `carve` became `carves` (a member can be at
  lunch and in a meeting in the same hour), and a carve no longer requires an
  active cell (a meeting can be booked outside someone's hours; a lunch can't).
  Slices are sorted and trimmed so the gradient stays a single left-to-right
  sweep - out-of-order stops get silently clamped by CSS into a smear rather
  than an edge. Each slice carries its own colour, so the component still
  knows nothing about what a carve-out means.
- Status: `meeting` added to both type files and STATUS_META, absent from
  SETTABLE_STATUSES and from the schema enum (same treatment as `break`).
  `resolveDisplayStatus` gained an `inMeeting` boolean - deliberately NOT
  folded into ScheduleState, which describes standing hours that meetings
  aren't part of. The added parameter broke every call site loudly, which is
  what caught a dropped `lastSeenAtMs` argument in TeamMemberCard during the
  build.
- The sidebar's and card's override notes now name the ACTUAL reason
  (in a meeting / at lunch / off shift). They previously hardcoded "off
  shift", which after this phase would confidently mis-explain a correct
  display.
- New `MeetingPanel.tsx` between the Overlap Finder and the grid: find the
  overlap above, book it here, see it below. Attendees prefill from whoever
  was checked in the finder, plus yourself - so the common path never hits the
  self-attendance 403 at all. It contains the ONE place in the app where a
  wall clock becomes an instant (`dayjs.tz(date + time, viewerTimezone)`),
  marked as such: using plain `dayjs()` there would silently use the BROWSER's
  zone, which is right only while it happens to match the viewer's.
- `deleteMeeting` checks res.ok, unlike the older `deleteMember` - a delete
  here can be REFUSED rather than merely fail, and without the check a member
  clicking delete on someone else's meeting would watch it vanish and
  reappear on the next poll with no explanation.
- Tests: 21 new cases, 89/89 green via the compiled-JS harness (Vitest still
  can't run in the sandbox - rolldown native bindings). Harness verified by
  deliberately breaking an assertion and confirming it failed. Backend
  validation checked separately with a throwaway harness, 18/18.
  THE DST PAIR is the one worth understanding: two meetings, each exactly two
  hours of real elapsed time, both in Chicago, drawn at DIFFERENT WIDTHS -
  spring-forward spans three wall-clock hours (01:00->04:00), fall-back spans
  one (01:30->02:30). An implementation that read the start's offset once and
  applied it to both ends gives a clean 2-hour block in both cases and passes
  every other test in the file.

TWO BUGS FOUND IN SELF-REVIEW, before Tim tested - both would have shown up
in QA as "the timezone code is broken" while being nothing of the sort:

- STALE MEETING WINDOW. The meetings request builds its date window from
  `viewerTimezone`, but the fetch only fired on mount. So (a) on first load
  `members` is still empty and viewerTimezone is the 'America/Chicago'
  FALLBACK, meaning the initial fetch asks for the wrong day for anyone else,
  and (b) switching the viewer dropdown didn't refetch at all. Either way the
  window stayed wrong until the next poll (~15s). The mount effect now depends
  on `[viewerTimezone]`. `refreshAllData` is deliberately NOT in the deps -
  it's redefined every render, so including it loops; the values that matter
  are covered by viewerTimezone. This also silenced the pre-existing
  exhaustive-deps warning at that site.
  Worth noting the failure mode: it would have made meetings appear missing or
  duplicated at exactly the moment you switch timezones to TEST the timezone
  handling. A stale fetch wearing a timezone bug's costume.
- NESTED CARVE-OUTS SWALLOWED. The first cut built the cell as ONE gradient
  with every slice's stops in it, which needs the slices sorted and overlaps
  trimmed to keep stops ascending. That quietly ate any slice CONTAINED in
  another: a 12:15-12:45 meeting inside a 12:00-13:00 lunch trimmed to zero
  width, so the cell drew as pure lunch. status.ts says a meeting outranks a
  lunch and the grid was saying the opposite.
  Fixed by LAYERING instead of merging: one gradient layer per slice,
  transparent outside its own range, over a solid `backgroundColor` base.
  Overlaps then resolve by stacking order with no sorting, no trimming and
  nothing lost. CSS paints the FIRST background-image layer on top, so the
  list is reversed and the rule becomes "later slices win" - which lets the
  CALLER own priority (ScheduleGrid lists lunch first, meetings after) and
  keeps ScheduleCell ignorant of what a slice means. Simpler than the code it
  replaced, which is usually the sign the first design was fighting itself.

- `npx tsc -b` clean in frontend, `npx tsc --noEmit` clean in backend. NOTE
  for future sessions: `tsc --noEmit` in frontend/ is a NO-OP - the root
  tsconfig has `files: []` and only references the app/node projects, so it
  silently reports nothing. Use `tsc -b`. ESLint times out in the sandbox (as
  in Phase 2), so lint and Vitest were both run on Windows - see VERIFIED
  above.

### DECISION: meeting model (8/3, design pass — no code)
Settles the four questions in `docs/phases/phase-3-meetings.md` plus two
consequences that only surfaced once the answers were lined up against the
existing code. Scope edge unchanged: create / view on grid / delete, single
occurrence, no invites, RSVPs, notifications, conflict warnings, or sync.

STORAGE, restated because it's the trap: `startsAt` / `endsAt` are UTC
`Date`s. Every other time field in this project is a wall-clock `HH:mm`
string with no date and no offset, and the two must not meet. A standing
9am is a different instant per person; a meeting is one instant that reads
as a different wall clock per person.

1. WHO CAN CREATE — any authenticated member, but the creator MUST be one of
   the attendees. Admins are exempt and can book for anyone. Delete is
   creator-or-admin.
   The existing rule is "trust `req.user.teamMemberId`, never a client id,"
   which assumes a write has exactly one subject. A meeting has several, so
   the rule doesn't transfer directly - but its INTENT does: you may commit
   your own time, not someone else's unilaterally. Requiring self-attendance
   is that intent applied to a multi-subject write. It's still a JWT-derived
   check, not a client-supplied one; the difference is that the JWT id must
   appear IN the attendee list rather than BE the target.
   Rejected admin-only: the Overlap Finder is deliberately open to every
   member (see the 7/18 access decision), so an admin-only booking flow would
   leave the feature dead-ending for exactly the people it was opened up for.
   Rejected fully-open: nothing would tie a write back to its author, and
   "member A books member B and C into a 6am call" is a real thing to be able
   to say no to.

2. IN-PROGRESS MEETING AFFECTS STATUS — yes. NEW derived-only `meeting`
   status ('In a meeting'), built exactly like `break`: absent from
   `SETTABLE_STATUSES` (an allowlist, so the API rejects it without knowing
   it exists) and absent from the TeamMember schema enum, since nothing ever
   writes it and letting the DB accept it would only create a way for the
   value to get stuck in a document no schedule change could clear.
   The "a meeting is the most actively-working a person gets" argument is
   true and still loses, because the dashboard doesn't answer "are they
   working," it answers "can I ping them right now." During a meeting the
   answer is no. Reusing `break` was rejected for the same reason `break`
   didn't reuse `away`: the grid would draw a meeting while the sidebar said
   "At lunch."

   PRECEDENCE (falls out of 1 and 2, and needs stating because a meeting can
   be booked over a lunch):
     1. no recent heartbeat -> 'offline'
     2. off-shift           -> 'offline'
     3. in a meeting        -> 'meeting'  (NEW)
     4. in a standing break -> 'break'
     5. whatever they set   -> as-is
     6. never set anything  -> 'away'
   Meeting sits ABOVE break because both are plans, but one is specific and
   dated while the other is a weekly default. Someone who accepted a meeting
   across their usual lunch has, by booking it, said which one is happening.
   Meeting sits BELOW the heartbeat for the reason break does: a booking is a
   plan, the heartbeat is evidence, and a laptop shut for an hour shouldn't
   render as a meeting in progress.
   Meeting stays below off-shift too - a meeting outside someone's hours
   still shows on the grid (see consequence B), but the sidebar keeps saying
   offline, because "booked" and "here" are different claims.

3. OVERLAP ROW ACCOUNTS FOR MEETINGS — yes, and STRICT, identical to the
   Phase 2 lunch rule: any meeting touching an hour kills that whole hour for
   the row, even a 15-minute one. This is nearly free rather than scope
   creep - the overlap check already excludes carve-outs, so meetings arrive
   as additional carve-outs in the same list. Without it the row would say
   "everyone is free at 2pm" about a 2pm that's already booked, which is
   worse than the feature not existing.

4. CROSS-DAY — the VIEWER's local calendar day decides. Fetch meetings
   overlapping the viewer's local today, draw each at its hour-of-day on the
   viewer's clock, in every attendee's row. One meeting, one instant, one
   column. A meeting that's tomorrow for you is simply not on today's grid
   even if it's tonight in Tokyo.
   Rejected per-attendee local day, despite it mirroring how SHIFTS resolve
   (by the member's own weekday). That mirroring is a false friend: a shift
   genuinely IS per-person wall-clock, so resolving it per-person is correct.
   A meeting is one shared instant, so resolving it per-person would draw the
   same meeting in some rows and not others, visually implying different
   people are in different meetings. The grid header already says "Viewer
   TZ" - this makes that honest for meetings too.

CONSEQUENCE A - carve-outs become a LIST, not a single value. A member can
have a standing lunch and a meeting inside the same hour cell. `ScheduleCell`
takes one `carve` today; it needs an array, and the gradient builder needs to
walk sorted, non-overlapping-by-construction slices. This is the generic
carve-out rendering earning its keep, but it is a real change to the
component, not a free inherit.

CONSEQUENCE B - a meeting can fall OUTSIDE a member's shift hours; a lunch
never can (the API rejects one). `ScheduleCell` currently only paints a carve
when `isActive`, so a 9pm meeting would silently not render - which is
exactly the booking most worth seeing. The carve gate stops keying off
`isActive` and keys off the carve itself; a carve on an idle cell reads as
"booked outside their hours," which is the true statement.

## COMPLETED — Hours editor timezone context + carve-out tick fix (8/2)
Closes the HoursEditor "which day is today for them" known issue from 7/31.
Tim hit the same confusion independently during Phase 2 QA, which is a decent
signal it was the right thing to fix.

The reframing that made it better than the logged fix: the root problem isn't
the missing highlight, it's that THE FORM NEVER SAID WHOSE CLOCK THE INPUTS
ARE IN. They're the member's own local wall-clock time, so an admin setting
09:00-17:00 for a Sydney member is setting HER 9am. Everything else about the
confusion follows from that being unstated.
- Admin mode gets a header panel: whose local time the inputs are in, their
  timezone, their current day+time, yours, and the live offset between you.
  Self mode skips it - "times are in your local time" on your own page is
  noise.
- An amber line appears ONLY when the two clocks disagree about the date,
  which is the exact case that caused the 7/31 mis-edit.
- The weekday row matching `now.tz(target.timezone).day()` is outlined and
  labelled "today for them" (self mode: "today").
- Offset is computed live from two moments, never stored - the gap changes
  twice a year and the two ends rarely switch on the same date, so
  Sydney-to-Chicago is 15, 16 or 17 hours depending on the week.
- Clocks read `now` from TeamContext (ticks with the poll) rather than
  calling dayjs() at render, so they stay live on an open tab. That matters
  most in precisely the situation this display exists for.
- A bad timezone string on a member degrades to "no header, no highlight"
  rather than throwing - dayjs throws on unknown zones.
- REJECTED: reordering rows to start on the target's today. A stable
  Monday-first week is easier to scan than one that shuffles under you.

Also fixed the carve-out tick marks: the repeating-linear-gradient had a unit
of `25% + 1px`, so each tick drifted a pixel right of the last and the pattern
wrapped far enough to paint a spurious FOURTH line near the cell edge. Four
slightly-off lines read as a rendering glitch. Now three explicit stops.

SAFETY FIX found by code review, not by testing: when the GET failed,
HoursEditor still rendered the form - prefilled with a complete, plausible
default 9-5 week - with Save enabled. Saving from that state would write
defaults over the member's real hours. The form is now replaced by an error
panel with a Try again button (a reloadToken in the effect deps, since
targetId hasn't changed and nothing else would refire the fetch). Pre-existing
hazard, not introduced by Phase 2.

## COMPLETED — Overnight shifts now actually accepted (8/2)
Found in Phase 2 QA: entering a Sunday 20:00-05:00 shift errored with "start
time must be before end time". Not a Phase 2 regression - the rule came from
the old AddTeamMemberForm and was carried verbatim into the new backend
validator, with a comment noting it as a deliberate limitation.

It wasn't defensible on inspection. The RENDERING side always supported
overnight: getScheduleState treats them as a union of two pieces, HourRange
carries isOvernight, isHourInRange handles the wrap, and all of it was tested.
The README lists cross-midnight handling as a core design constraint. So the
form was refusing data the app could display correctly - a contradiction, not
a scope decision.

THE TRICK, in both validators: measure durations FORWARD with a wrap
(`(end - start + 1440) % 1440`) instead of subtracting, and express break
containment as OFFSETS FROM THE SHIFT START rather than absolute clock times.
In offset space an overnight shift is just a 0..length range again, so the
wrap stops leaking into every comparison. Equal start and end gives 0, NOT 24
hours - an all-day shift conjured from a typo is worse than an error.

- `validateShiftTimes` allows start > end; still on-the-hour and >=60min.
  New "start and end time cannot be the same" message replaces the old
  start >= end rejection.
- `validateBreakTimes` containment is offset-based, so a lunch may itself
  cross midnight inside an overnight shift. On a SAME-DAY shift a backwards
  break still gets the pointed "break start must be before break end"; on an
  overnight shift that comparison is meaningless (23:45-00:15 is legitimately
  backwards on the clock) so it falls through to the containment check.
- `getScheduleState`'s break test gained the same union treatment its shift
  test already had. The old `breakStart < breakEnd` guard meant a
  midnight-crossing lunch silently never registered as on-break.
- HoursEditor mirrors all of it, now in plain minute math - `dayjs` is no
  longer imported there at all.
- Tests: 8 new cases in scheduleTime.test.ts built around the reference case
  (Sunday 20:00-05:00 shift with a 23:45-00:15 lunch - a midnight lunch inside
  a midnight-crossing shift), 68/68 green. Backend harness 26/26 including
  overnight containment at both edges.

## COMPLETED — Lint cleanup: 14 errors to 0 (8/2, committed cf2667b)
Surfaced right after Phase 2, but ALL 14 pre-dated it - proven by the flagged
files having an empty diff against HEAD. Cause is a dependency bump, not new
code: `eslint-plugin-react-hooks` is on v7, whose recommended config added the
React Compiler-era effect rules (`set-state-in-effect`). Caret ranges in
package.json mean a plain `npm install` pulls these in. The "lint clean" notes
on the Phase 0/1 entries were written before that.

Three of the fixes turned out to be real bugs hiding behind `any`:
- `TeamContext.setStatus` read `previousStatus` off an optional `.find()`, so
  a member missing from the list (deleted in another session between render
  and click) would roll back to `status: undefined`, writing a broken member
  object. Now bails early. Invisible while `members` was `any[]`.
- `HoursEditor`'s load effect had no cancellation, so a slow response for a
  previous target could land after an admin switched members and overwrite the
  newer data. Now guarded.
- Same effect merged fetched days over the PREVIOUS target's `week` state
  (`setWeek(prev => ...)`), so switching members inherited rows the new member
  had no record for. Now starts from a fresh `emptyWeek()`.

Changes:
- `now: any` / `members: any[]` / `viewerMember: any` in `TeamContextType` are
  properly typed. The old comment claimed `any` was forced because this file
  is hand-mirrored on the backend - but `TeamContextType` has NO backend
  counterpart (only TeamMember / RecurringShift / DayOfWeek do), so importing
  `Dayjs` costs nothing.
- API responses are parsed as `unknown` and narrowed with `Array.isArray`
  rather than asserted into the happy-path shape - both endpoints return a
  `{ message }` object on failure.
- FAST REFRESH: `useAuth`/`useTeam` moved into new `context/useAuth.ts` and
  `context/useTeam.ts` alongside their context objects, so the provider
  modules export only components. A module exporting both a component and a
  hook forces a full remount on every edit, which in practice means losing
  your logged-in session mid-development. 13 import sites updated.
  Named `useAuth.ts` NOT `authContext.ts` deliberately - Windows is
  case-insensitive and `authContext.ts` would collide with `AuthContext.tsx`.
- `HoursEditor` loading state is now DERIVED (`loadedFor !== targetId`)
  instead of a `useState` set synchronously at the top of the effect. That
  second render pass before paint is exactly what the new rule flags, and
  deriving reads better anyway: "loading" IS "the data on screen isn't for
  this member yet."
- Unused `err` catch bindings dropped (ES2019 optional catch binding).
- `npx tsc --noEmit` clean, `npx eslint` clean, harness still 60/60.

## COMPLETED — Phase 2: recurring lunch break (8/2)
Standing daily break as optional `breakStart`/`breakEnd` on `RecurringShift`,
plus the generic carve-out rendering that Phase 3's meetings inherit.

DECISION - granularity: breaks land on a QUARTER hour (`:00/:15/:30/:45`);
shift times stay on-the-hour. The two rules differ because the grid treats
them differently: a shift boundary decides whether a whole cell lights up, so
it can't be finer than a cell, but a break is drawn as a fractional fill
INSIDE its cell and can be. Rejected "on-the-hour only" (can't express a
30-minute lunch, which is the common case) and "any minute" (widest gap
between stored data and what's drawn, and inconsistent with shift validation).

DECISION - rendering: cells take a FRACTION, not a half. `ScheduleCell` paints
a hard-stop gradient from `carveOutFractionInHour`, so a 12:00-12:30 lunch
fills the left half of the 12:00 cell. Quarter-hour tick marks are drawn ONLY
on cells that contain a carve-out - a permanent ruler across all 24 columns of
every row was the alternative and it buries the "read availability in two
seconds" constraint under ~500 hairlines. Fractions (not halves) is what makes
this reusable: Phase 3's meetings are arbitrary instants (2:15-2:45) and a
half-only renderer would need rewriting.

DECISION - status: NEW derived-only `break` status ('At lunch', amber), not a
reuse of `away`. Non-settable exactly like `offline` - omitted from the picker
and from `SETTABLE_STATUSES`, which is an allowlist so the API rejects it
without needing to know it exists. It is also deliberately ABSENT from the
TeamMember schema enum (unlike `offline`): nothing ever writes it, so letting
the DB accept it would only create a way for the value to get stuck in a
document that no schedule change could clear. Reusing `away` would have meant
the grid drawing a lunch explicitly while the sidebar told a vaguer story
about the same fact.

DECISION - overlap row is STRICT: any carve-out touching an hour kills that
whole hour, even a 15-minute one. Losing 45 usable minutes is cheaper than
suggesting a slot that lands on someone's lunch, which is the exact problem
this feature exists to fix. A half-lit overlap cell would imply bookable time
the row isn't asserting.

Full status precedence after this phase:
  1. no recent heartbeat -> 'offline'
  2. off-shift           -> 'offline'
  3. in a standing break -> 'break'    (NEW)
  4. whatever they set   -> as-is
  5. never set anything  -> 'away'
The break sits BELOW the heartbeat on purpose: a lunch window is a PLAN, the
heartbeat is EVIDENCE. If the laptop has been shut an hour, "at lunch" would
dress up an absence as a scheduled one.

- Model: optional `breakStart`/`breakEnd` on `RecurringShift`, mirrored by hand
  into both type files. `getCurrentShiftForMember` drops a HALF-set pair rather
  than passing a one-ended window along (old documents predate the API rule).
- `scheduleTime.ts`: new `CarveOut` type (fractional hours, viewer tz), plus
  `resolveBreakCarveOutInViewerTz` and `carveOutFractionInHour`. `CarveOut`
  says nothing about lunch on purpose - meetings produce the same shape.
  `getScheduleState` gains `on-break`, checked AFTER the shift test passes so
  it can only ever refine on-shift, never contradict off-shift.
- New `frontend/src/components/ScheduleCell.tsx` - the one place a cell is
  drawn. Member rows and the overlap row both render through it. Knows nothing
  about lunches; takes a fraction and paints it.
- BACKEND VALIDATION GAP CLOSED (was in KNOWN ISSUES since 7/24): new
  `backend/src/utils/shiftValidation.ts` enforces the three shift rules
  server-side (start<end, on-the-hour, >=60min) plus the break rules
  (both-or-neither, quarter-hour, inside the shift, none on an off day).
  Note it rejects OVERNIGHT standing shifts, which `scheduleTime.ts` renders
  fine - a deliberate carry-over of the existing HoursEditor rule, since no UI
  can produce one and allowing it through the API would create data no form
  could edit back.
- The PUT route now `$unset`s the break pair whenever a payload omits it -
  without that, removing a lunch in the editor would leave the old window in
  the document forever, since `$set` only ever adds.
- DEAD CODE REMOVED: `/api/work-shifts` mount, the route import, and the
  `WorkShift` interface in both type files. THE TWO FILES THEMSELVES STILL
  NEED DELETING BY HAND - see START HERE above.
- CORRECTION to the phase brief: it claimed `migrateToRecurringShifts.ts`
  reads the raw Mongo collection and so would survive the model's deletion.
  It did NOT - it imported `WorkShiftModel`, and deleting the model would
  have broken the script. Rewritten to go through
  `mongoose.connection.collection('workshifts')`, which is what
  `migrateStatus.ts` already did and what makes a migration outlive the schema
  it migrates away from. Worth remembering for Phase 3: check what a "template"
  actually does before trusting a doc that says it's safe.
- TWO BUGS the new tests caught, both now fixed: (1) `carveOutFractionInHour`
  returned null for every overnight carve-out - an overnight window is two
  segments, not one with a wrapped end, and clamping it as a single range
  goes negative and collapses to zero width. (2) `dayjs.tz()` THROWS on an
  unparseable string rather than returning an invalid instance, so the
  `isValid()` guard after it never ran - a malformed break in the DB would
  have taken the whole grid down. Shape-checked with a regex before dayjs
  sees it now.
- Tests: 26 new cases in `scheduleTime.test.ts` (break layer in
  getScheduleState, break passthrough + half-set drop, carve-out tz
  conversion, fractional cell math, overnight splits, malformed fallbacks,
  break precedence in resolveDisplayStatus), 60/60 green via the compiled-JS
  harness. Backend validation checked separately with a throwaway harness,
  17/17. RUN `npm run test:run` ON WINDOWS to confirm under real Vitest.
- `npx tsc --noEmit` clean in frontend; backend clean except the two files
  awaiting manual deletion. ESLint wouldn't finish in the sandbox (times out)
  - run `npm run lint` on Windows.

## COMPLETED — Phase 1: polling + heartbeat presence (7/31, verified 8/2)
Closes both live-sync bugs logged 7/25 (see KNOWN ISSUES, now removed).
- Backend: `lastSeenAt?: Date` added to `TeamMember` (model + both mirrored
  type files). Stamped on authenticated `GET /api/team-members` - that route
  already fires on every poll, so it doubles as the heartbeat with zero extra
  round trips. Debounced to writes only when the existing stamp is >10s old
  (`HEARTBEAT_DEBOUNCE_MS` in `teamMembersRoutes.ts`), keyed off
  `req.user.teamMemberId` from the JWT (never a client-supplied id, same
  pattern as `PATCH /:id/status`), and fire-and-forget - a failed heartbeat
  write doesn't fail the read.
- Frontend: new `frontend/src/hooks/useRefreshTick.ts` is the single polling
  seam - one interval calling a passed-in `refresh` fn, exposing a ticking
  `now` (dayjs) alongside it. Called once inside `TeamProvider`, `now` is
  exposed on `TeamContext` so `TeamStatusSidebar` and `TeamMemberCard` both
  read time from context instead of calling `dayjs()` at render time - that's
  what actually closes the "stale in an open tab" bug (a re-fetch alone
  wasn't enough; the tick has to cause a re-render, which passing `now` into
  `getScheduleState` guarantees).
- `resolveDisplayStatus` (status.ts) gained the heartbeat layer on top of the
  existing off-shift layer: no heartbeat within `HEARTBEAT_STALE_MS` (45s) ->
  `offline`, overriding whatever was stored. Takes `lastSeenAtMs`/`nowMs`/
  `staleThresholdMs` as plain numbers, not a lastSeenAt string + a `now`
  object - keeps status.ts free of dayjs, same split as before. A member with
  no `lastSeenAt` at all (never logged in) is NOT treated as stale - that's
  an absence of information, same reasoning as unset hours, and it falls
  through to their stored status (defaulting to `away`).
- Tuned values: poll interval 15s, heartbeat staleness threshold 45s (both
  named constants in `useRefreshTick.ts`).
- RACE CONDITION: `setStatus`'s optimistic update can be overwritten by a
  poll landing before the PATCH resolves, flickering the UI back to the old
  value. Fix chosen: skip applying poll results, not defer the poll itself.
  `TeamContext` now tracks in-flight writes in a `pendingStatusWrites` ref
  (member id -> the optimistic status); `refreshAllData` re-applies any
  pending write over the freshly polled data before calling `setMembers`.
  Chosen over versioning the responses - simpler, and the in-flight window is
  one PATCH, so there's nothing else worth deferring.
- Tests: 5 new cases in `scheduleTime.test.ts`'s `resolveDisplayStatus`
  describe block (stale forces offline even on-shift+active, exact-threshold
  boundary, past-threshold, never-logged-in falls through, fresh heartbeat
  doesn't mask off-shift), plus the existing cases updated for the new
  signature. Vitest still can't run in the Linux sandbox (native bindings) -
  verified via a throwaway compiled-JS harness instead (10/10 green,
  including the pre-existing cases re-checked under the new signature).
  CONFIRMED 8/2: `npm run test:run` green on Windows under real Vitest.
- `npx tsc -b` clean both sides, `npm run lint` clean in frontend.
- VERIFIED 8/2 (Tim, manual QA): two browser profiles logged in as different
  members - a status change in one showed in the other within ~15s; a tab left
  open across a shift-end boundary flipped to offline without a reload; closing
  one profile derived offline in the other within ~45s. All as designed.

## COMPLETED — Phase 0: config extraction (7/31)
Prerequisite for deploying anywhere other than localhost, pulled out so the
Phase 1 polling diff stays readable.
- New frontend/src/config.ts exports API_BASE (`import.meta.env.VITE_API_URL
  ?? 'http://localhost:5000'`) - all 14 hardcoded `http://localhost:5000`
  fetch calls across AuthContext, TeamContext, AddTeamMemberForm,
  HoursEditor, and TeamMemberCard now import this instead. API_BASE is now
  the single place the backend URL lives - Phase 1's new fetches (and
  anything else added later) should import it rather than hardcoding a URL.
- frontend/.env.example added (documents VITE_API_URL); frontend/.gitignore
  didn't already cover `.env`, added it.
- backend/src/server.ts: CORS origin now reads `process.env.CORS_ORIGIN`,
  falling back to the same `http://localhost:5173` literal.
  `credentials: true` and the rest of the CORS config untouched.
- backend/.env.example created (didn't exist) - mirrors every process.env
  key actually referenced in backend/src (MONGODB_URI, JWT_SECRET, PORT,
  NODE_ENV, SEED_ADMIN_EMAIL/PASSWORD from resetAdminPassword.ts) plus the
  new CORS_ORIGIN. Root .gitignore already covered `.env` / `backend/.env`.
- Verified: `npx tsc -b` clean in both backend and frontend, `npm run lint`
  clean in frontend. Grepped for localhost:5000/5173 - only the two
  fallback defaults (config.ts, server.ts) and the .env.example files
  remain.
- VERIFIED 8/2: the fallbacks were already load-bearing, so no separate test
  was needed. `frontend/.env` doesn't exist (only `.env.example`), and
  `backend/.env` never had CORS_ORIGIN or PORT in it - so VITE_API_URL,
  CORS_ORIGIN, and PORT were ALL running on their defaults throughout the
  Phase 1 two-profile QA, login and auth cookie included.
  NOTE: the original wording here ("run with no .env files present") was
  misleading - MONGODB_URI and JWT_SECRET are non-null-asserted with no
  fallback, so the backend cannot start without a .env at all. Only
  CORS_ORIGIN / PORT / VITE_API_URL are optional.

## DECISIONS — live presence, breaks, meetings (7/25)
Design session, no code. Started as "build break logging," ended up
reordering the roadmap: THE APP HAS NO LIVE PRESENCE, and breaks were
blocked on it rather than merely unbuilt. A 30-minute fact on a dashboard
that refreshes at login is invisible by construction.

Two distinct bugs, both logged in KNOWN ISSUES:
- refreshAllData() fires once on mount. Two users on different machines
  never see each other's status changes without a reload.
- Nothing re-renders on a clock tick. getScheduleState() reads dayjs() at
  render time, so in an open tab a member's derived-offline never fires.
  Phase 8 logic is correct, just never asked again. LIVE TODAY.

### DECISION: polling + heartbeat, not Socket.io (reverses README "Planned")
The case for sockets was connection-as-presence: an open connection is an
unforgeable answer to "are they actually here," making 'active' earned
rather than a stale button-click. Polling matches it via HEARTBEAT.

Mechanism: clients poll ~15s, those requests are already authenticated, so
the server stamps lastSeenAt for req.user.teamMemberId on each poll. "Here"
= heartbeat within ~45s (2-3 intervals of grace so one dropped request
doesn't flap them offline). Laptop closes, polls stop, stamp goes stale,
everyone derives offline on their next poll.

What settled it: an open TCP connection is a POOR liveness signal - sockets
sit half-open on dead networks and disconnect events get missed, so socket
presence needs a heartbeat layer anyway. A timestamp is self-healing.
Cost: ~45s lag going offline, brief propagation delay. Acceptable.

NOT a one-way door. Consumers don't care where an update came from, only
that data changed. Put a seam there (a hook owning "when do we refresh") -
polling is an interval calling refreshAllData(), sockets are the same hook
with a different engine.

### Status precedence (extends Phase 8's stack)
  1. no recent heartbeat -> 'offline'  (NEW - they are not here)
  2. off-shift           -> 'offline'  (existing)
  3. in a standing break -> away-ish    (NEW - see lunch below)
  4. whatever they set   -> as-is
  5. never set anything  -> 'away'
1 and 2 don't conflict (off-shift AND gone is offline either way). Layer 1
exists for the ON-shift-but-gone case, where a stored 'active' is at its
most misleading.

Heartbeat piggybacked on GET /api/team-members costs zero extra requests
but turns every read into a write. Fine at this scale; debounce to >10s-old
stamps if it ever matters.

### Deployment research (7/25) - informed the above
- ONE service, not several. Express serves the built frontend (express.
  static + catch-all for client routes). Not just convenience: same origin
  keeps the sameSite:lax cookie working. Split domains would force
  sameSite:'none' + secure - the third-party-cookie pattern browsers have
  spent years clamping down on, and it breaks differently in Safari.
- Free tiers degraded since ~2021: Heroku gone, Fly.io gone for new signups
  (legacy accounts keep it), Railway now $1/mo credit (won't keep anything
  running). Render is the remaining real one - no card, git-push deploy.
- Render free: spins down after 15 min idle, ~1 min cold start. Since Feb
  2026 WebSocket messages count as activity, so sockets were viable there.
  750 instance hrs/month vs 744 in a 31-day month - always-awake just fits.
- Atlas free tier (512MB, formerly M0) is permanent. Render's free Postgres
  expires after 30 days - irrelevant to us, but a trap worth knowing.
- PREREQUISITE: config extraction (Phase 0). 14 hardcoded localhost:5000
  refs in frontend, CORS origin hardcoded in server.ts.
- Test ladder: two browser profiles -> LAN via `vite --host` from a phone
  (real network drops) -> cloudflared tunnel for a second real person ->
  Render.

### DECISION: ad-hoc break logging is CUT
Redundant with 'away'. It only looked necessary because 'away' didn't reach
anyone - with no live sync, setting it changed nothing on a colleague's
screen. Once polling propagates status in ~15s, "I'm stepping out" is
served by a button that already exists.

Consequence: WorkShift model + /api/work-shifts routes are DEAD CODE (no
reader since the Phase 4/5 cutover; dated breaks were their last use).
Delete in Phase 2.

### DECISION: recurring lunch break, in the hours model
Different thing despite the shared word: a standing 12:00-12:30 is a
SCHEDULE fact (known ahead, repeats, computable from data already fetched),
where an ad-hoc break is a presence fact. That's why this one earns a model
and the other doesn't.

Reverses "breaks can't be recurring" below. That decision was right for the
thing it was about - a spontaneous absence genuinely can't recur. The
feature changed underneath it. A pivot, not a contradiction.

Also delivers what breaks were originally wanted for: overlap stops
suggesting times that land on someone's standing lunch, with no live data.

Shape: optional breakStart/breakEnd (HH:mm) on RecurringShift. One record
per member per weekday, one break per day - covers lunch. A multi-break
model is more general than needed; revisit if a real second break appears.

Open: 12:00-12:30 in an hour-bucketed grid. Same granularity tension as the
old design but smaller - rendering the whole 12:00 cell as lunch is
probably fine, no grid rework.

### DECISION: meeting model, ACCEPTED with a hard scope edge
Earns its place because the overlap finder dead-ends: it says when everyone
is free, then hands you to an external calendar. A meeting model closes the
loop (find overlap, book it, see it on the grid) and reuses the timezone/
grid machinery already built.

SCOPE EDGE: create / view on grid / delete. Single occurrence. No invites,
RSVPs, notifications, conflict warnings, or calendar sync. Meetings attract
features endlessly; past that line is a separate decision.

THE TRAP - meetings have DIFFERENT TIMEZONE SEMANTICS from everything else
here. Standing hours are wall-clock-local ("9am wherever you are" = a
different instant per person). A meeting is ONE FIXED INSTANT reading as a
different wall-clock time per attendee. So meetings store a UTC datetime,
NOT an HH:mm string like every other time field. Wall-clock is the only
pattern in the codebase today, so scheduleTime.ts needs a genuinely new
function, not an adaptation. Mixing the two is the classic scheduling bug.

### Note for later: lunch and meetings are cousins
Both are "carve-outs from otherwise-available time" drawn inside a shift
block. Teach the grid to draw a carve-out ONCE and meetings inherit it -
build lunch that way instead of hardcoding something lunch-specific.

## COMPLETED — Phase 8: derived-offline + default-away (7/24)
This closes the recurring-shift workstream (#1). Two changes that turned out
to be the same idea: a status should never assert more than we actually know.

DECISION (revised from the original plan): the default STORED status is now
'away', not 'active'. 'active' is a claim that someone is present and
available, and only the person can make it truthfully - a member an admin
creates at 3am who has never logged in hasn't asserted anything. This also
dissolved the open question logged above about unset members: a brand-new
member now reads as "Away" + "Hours not set" with NO unset-specific
derivation rule needed. Backend model default changed; existing members are
unaffected (they carry explicit values from migrateStatus.ts), so no
migration.

Full precedence, highest first:
  1. off-shift          -> 'offline'  (derived, overrides what they set)
  2. whatever they set  -> as-is
  3. never set anything -> 'away'

- New getScheduleState(resolution, memberTimezone, now?) in scheduleTime.ts
  returns 'on-shift' | 'off-shift' | 'unknown'. IMPORTANT: off-shift is NOT
  just isOff days - a member with Wed 9-5 set is also off shift at 8pm
  Wednesday, so this compares their actual local clock against their hours.
  Minute-accurate (not hour-bucketed like the grid): finishing at 17:00 means
  17:30 reads as off. Half-open [start,end) matching isHourInRange, overnight
  handled as the union of both pieces. Malformed times / missing tz fall back
  to 'unknown', deliberately NOT 'off-shift' - a NaN comparison is silently
  false and would otherwise read as "not working."
- New resolveDisplayStatus(storedStatus, scheduleState) in status.ts. Kept in
  status.ts, not scheduleTime.ts, so the split stays clean: time logic answers
  "where are they in their schedule," status logic answers "what do we show."
  No dayjs in status.ts.
- 'unknown' does NOT derive offline. No hours on file means we know nothing
  about their schedule, which is different from knowing they're off - the
  "Hours not set" label carries that instead.
- TeamStatusSidebar + TeamMemberCard both render the DERIVED status, so the
  member and admin views can't disagree. The picker still highlights the
  STORED value (that row answers "what did I choose"). Added a note on your
  own row when derivation overrides a real choice - without it, clicking
  Active while off shift looks like the button did nothing.
- Tests: 9 new cases in scheduleTime.test.ts (getScheduleState boundaries,
  overnight, member-tz-not-viewer-tz, off vs unset, malformed fallbacks) plus
  resolveDisplayStatus precedence. Vitest still can't run in the Linux sandbox
  (native bindings) - verified via a compiled-JS harness instead, 21/21 green,
  same pattern used for the Phase 4/5 work. RUN `npm run test:run` ON WINDOWS
  to confirm.
- tsc -b clean.

## COMPLETED — Unset-hours visibility (7/24)
Caught in manual QA: a new member with no hours renders an EMPTY grid row,
which reads as "not working today" - a different fact from "never set up."
The three consumers had drifted apart on this:
- TeamHoursPanel already distinguished Off / Not set (correct).
- TeamStatusSidebar showed "Off today" for off, the amber CTA for your OWN
  unset, and NOTHING for anyone else's unset.
- ScheduleGrid rendered off and unset identically (both are a null hourRange).
Root cause of the sidebar gap was conflating two separate things in the
Phase 7 decision: the CTA (actionable, correctly self-only) and the state
LABEL (informational, everyone's business). Split them - your own row keeps
the amber "Hours not set — set now" link, everyone else's gets a plain amber
"Hours not set" label.
ScheduleGrid's memberRows now carries `resolution` alongside hourRange (off
and unset both yield a null range, so only resolution.state can tell them
apart) and the 120px name column gets a muted second line: "Off today" or
"Hours not set". Chosen over distinct cell styling for unset rows - no
changes to the cell rendering or column math, which the overlap row depends
on staying pixel-aligned with.
tsc -b clean.

OPEN QUESTION this raises for Phase 8 — RESOLVED 7/24, see Phase 8 at top.
(Left for the reasoning trail; the premise below is now WRONG - the stored
default is 'away', not 'active'.) An unset member currently shows their
stored manual status, which defaults to 'active' - so a brand-new member who
has never set hours reads as "Active" in the sidebar. Decide during Phase 8
whether unset should derive to offline like off-shift does, or stay distinct
(arguably "we don't know" is not the same claim as "not working").
ANSWER: neither. Changing the stored default to 'away' dissolved the
question - no unset-specific derivation rule was needed. 'unknown' still
does NOT derive offline.

## COMPLETED — Phase 6/7 review fixes (7/24, same day)
Manual QA + self-review of the Phase 6/7 work turned up five issues:
- REGRESSION (caught in manual QA): HoursEditor's Back link sent self-mode
  users to /dashboard unconditionally, which strands an ADMIN - only
  AdminLayout renders the Schedule/Manage tabs, so an admin who clicked
  "My Hours" then Back lost all access to the Manage tab. This is the exact
  trap App.tsx's LoginRoute comment already warned about. Fixed by extracting
  homePathForRole() into new frontend/src/utils/routes.ts and using it in
  BOTH LoginRoute and HoursEditor, so the rule lives in one place instead of
  being restated (and forgotten) per call site.
- No way out of the hours page at all - added a Back link (admin mode returns
  to /admin/manage, self mode to homePathForRole(role)). Explicit paths, not
  navigate(-1), since history is unreliable when the page is opened directly.
- Stale grid after save: TeamContext only fetches on mount and route changes
  don't remount TeamProvider, so saved hours didn't show up until a manual
  refresh. handleSave now awaits refreshAllData().
- GET /hours error responses parse as a { message } object, not the expected
  array - the for...of would throw something unrelated. Added an res.ok check
  so the real error surfaces.
- "Hours saved" banner lingered while making new edits; updateDay now clears
  it. FirstRunHoursGate also hid itself on /profile/hours (it was floating
  over the page it points at).
- tsc -b clean after all of the above.

## COMPLETED — Recurring shifts: Phase 6 + 7 (7/24)
- New HoursEditor.tsx component (frontend/src/components/HoursEditor.tsx):
  one component driven by a `mode: 'self' | 'admin'` prop - self reads the
  target member from AuthContext.teamMemberId, admin reads it from the :id
  route param. Both paths call the same GET/PUT /api/team-members/:id/hours
  (routes already existed from the backend phase). 7 rows (Mon-first display
  order, values still 0-6 DayOfWeek underneath), each an Off checkbox or a
  start/end time pair. Unset days default to a prefilled 9-5 rather than
  blank inputs, so hitting Save on an untouched row produces a valid working
  day instead of a validation error. Save does one whole-week PUT, matching
  the route's replace-not-patch contract.
- Carried the exact shift-granularity validation from the old
  AddTeamMemberForm (start<end, on-the-hour, >=60min) into HoursEditor - the
  grid renders in whole-hour blocks, so this constraint has to live wherever
  times get written, not just at member creation.
- Routes added in App.tsx: /profile/hours (self, inside the "any authed
  role" layer) and /members/:id/hours (admin, nested inside the existing
  admin-only ProtectedRoute layer). Both reuse DashboardLayout purely for its
  shell (AppHeader, no tabs) - neither is part of the Schedule/Manage tab
  flow AdminLayout represents.
- Entry points: "My Hours" link in AppHeader (visible to every logged-in
  user, not just admins - everyone has hours to manage) and an "Edit Hours"
  button on each card in TeamMemberCard (admin -> /members/:id/hours).
- AddTeamMemberForm cleanup: removed startTime/endTime fields, their
  validation block, and the stale comment claiming the backend creates an
  initial WorkShift (it hasn't since the backend phase - POST /team-members
  no longer does that). Members now start with zero RecurringShift records
  and fill their own week via /profile/hours, matching the self-service
  seeding decision below.
- First-run gate: new FirstRunHoursGate.tsx, mounted once in App.tsx's
  ProtectedLayout (alongside Outlet, inside TeamProvider) so it floats over
  both /dashboard and /admin/* without being tied to either layout. Shows a
  dismissible bottom-right card when the logged-in member has zero
  RecurringShift records at all. Dismissal is in-memory only (component
  state) - reappears next login/reload by design, matches the "non-blocking"
  framing in the decision below rather than a permanent "seen it" flag.
  Exported shiftMemberId from scheduleTime.ts (was a private helper) so this
  and getCurrentShiftForMember share the same "does this shift belong to
  member X" logic instead of two copies drifting apart.
- Persistent CTA: TeamStatusSidebar's unset branch (previously rendered
  nothing) now shows an amber "Hours not set — set now" chip linking to
  /profile/hours, only on the logged-in member's own row (isSelf) - other
  members' unset rows stay silent, matching the decision that this isn't
  your hours to fix.
- tsc -b clean. eslint clean (npx eslint . run directly, no errors).
  Vitest still can't run in the Linux sandbox (native bindings) - run
  `npm run test:run` on Windows to confirm nothing broke; no scheduleTime.ts
  behavior changed, only a new export, so existing tests should be
  unaffected, but worth confirming.

## COMPLETED — Recurring shifts frontend cutover: Phase 4 + 5 (7/21)
- scheduleTime.ts rewritten:
  - getCurrentShiftForMember now takes (memberId, recurringShifts,
    memberTimezone, now?) and returns a ShiftResolution tagged union -
    { working, startTime, endTime } | { off } | { unset }. Replaces the old
    "first WorkShift record or undefined," which couldn't tell off from unset.
  - Resolves by the MEMBER'S OWN local weekday (now.tz(memberTz).day()), NOT
    the viewer's. DECISION (resolves the open sub-decision): this is a presence
    tool, so each row answers "on shift where they are." Viewer-tz conversion
    is a separate later step, so we keep both - correct day AND viewer's clock.
    Near a date boundary a member can legitimately show a different weekday
    than the viewer.
  - resolveHourRangeInViewerTz now takes the ShiftResolution and anchors its
    tz conversion to TODAY's date in the member's tz (now?), since recurring
    records carry no date and dropping it would break the DST offset. Returns
    null for anything that isn't a working shift.
  - isHourInRange / formatHourLabel / formatHourRange unchanged.
- scheduleTime.test.ts rewritten: `now` pinned per test for determinism; kept
  the cross-tz, overnight, and DST-pair cases; added working/off/unset and the
  member's-own-weekday boundary case (Fri 23:00 UTC = Sat in Tokyo). Verified
  all assertions pass against the compiled source (Vitest can't run in the
  Linux sandbox - node_modules has Windows/native bindings - so run
  `npm run test:run` on Windows to confirm; logic was checked via a
  compiled-JS harness, 31/31 green).
- TeamContext: swapped the /api/work-shifts fetch for /api/recurring-shifts;
  exposes `recurringShifts: RecurringShift[]` (was `shifts: any[]`). This is
  the FE cutover the migration was waiting on - old date-based WorkShift
  records can now be dropped from the dev DB whenever convenient.
- Repointed ScheduleGrid, TeamHoursPanel, TeamStatusSidebar to the new API.
  Panel chips now show Off / Not set (not a generic "No shift"); sidebar shows
  "Off today" for off days; unset shows nothing yet (its CTA is Phase 7).
- tsc -b is clean. Bycatch fix: TeamStatusSidebar's roster map was typed
  `member: any`, which tripped TS7053 on STATUS_META[member.status] (a
  pre-existing error, present on HEAD - build was red before this). Typed it
  as TeamMember. Callable out into its own commit if you'd rather.

## COMPLETED — Recurring shifts backend: model + migration + routes (7/21)
- New RecurringShift model: one record per member per dayOfWeek (0=Sun..6=Sat),
  optional startTime/endTime, isOff flag, unique index {teamMemberId,
  dayOfWeek}. Times required by the route only when isOff=false. RecurringShift
  + DayOfWeek types mirrored in backend + frontend.
- migrateToRecurringShifts.ts RAN against dev DB: seeded each member's old
  standing hours Mon-Fri, weekends off (28 records / 4 members, verified).
  Idempotent. Old WorkShift records LEFT in place - drop after FE cutover.
- Routes: GET /api/recurring-shifts (bulk, any auth); GET+PUT
  /api/team-members/:id/hours (self-or-admin whole-week replace, JWT-keyed like
  /status). Removed initial-WorkShift creation from POST /team-members (members
  now start unset).
- Nothing reads RecurringShift yet - app behaves as before until Phase 4/5.

## COMPLETED — scheduleTime.ts unit tests (7/20/2026)
- Vitest installed (frontend devDep, node env - no RTL/jsdom, these are
  pure functions). Scripts: `npm test` (watch), `npm run test:run` (once).
- New frontend/src/utils/scheduleTime.test.ts - 20 tests, all passing:
  - resolveHourRangeInViewerTz: null guards, same-tz passthrough, cross-tz
    (NY->LA), cross-tz overnight wraparound (Tokyo->LA), and a DST-sensitive
    pair (NY->UTC in Jan vs Jul) proving the conversion respects the date
  - isHourInRange: null, normal half-open [start,end), overnight OR-logic
  - getCurrentShiftForMember: string vs populated teamMemberId, no-match,
    incomplete-record skip - locks CURRENT "first valid shift" behavior as a
    regression net before #1 rewrites it
  - formatHourLabel / formatHourRange: midnight/noon, null placeholder
- Expected tz values were verified against real dayjs output before writing.
- This clears the #0 prerequisite; #1 is now unblocked.

## COMPLETED — Status enum: manual layer (7/18/2026)
- TeamMember.isAvailable Boolean replaced with a status enum
  ('active' | 'away' | 'dnd' | 'offline'), default 'active', in both the
  backend model/types and frontend types
  (SUPERSEDED 7/24: default is now 'away' - see Phase 8 at top for why)
- Backend PATCH /:id/status validates against SETTABLE_STATUSES
  (active/away/dnd only) - 'offline' is rejected because it's schedule-derived
- migrateStatus.ts backfilled existing members (true->active, false->away)
  via the raw collection, then dropped isAvailable - HAS BEEN RUN against dev DB
- Shared frontend/src/utils/status.ts holds STATUS_META (label/short/pill) and
  SETTABLE_STATUSES, used by both TeamStatusSidebar and TeamMemberCard so
  colors/labels can't drift
- toggleAvailability -> setStatus(id, status) in TeamContext, keeping the
  optimistic-update + rollback pattern (rollback now captures previous status
  first, since a 4-state value has no single "opposite" to flip back to)
- Sidebar's "can I edit this" now keys off real auth (AuthContext.teamMemberId),
  not the viewerId simulation - resolves half the "two sources of who am I"
  tech-debt item. Single toggle replaced with a 3-button picker.
- STILL TODO for this feature: the derived-offline layer - lands with #1
  below (needs reliable "on shift right now"). Until then, no member ever
  auto-shows offline; status is manual-only.
  DONE 7/24 - see Phase 8 at top. This feature is now complete.

## COMPLETED — Meeting Overlap Finder (by 7/18/2026)
- TeamHoursPanel built: checkbox chip per member with hours converted to the
  viewer's timezone, reusing getCurrentShiftForMember + resolveHourRangeInViewerTz
- Selection state lifted into ScheduleView.tsx as useState<string[]>, passed
  down as props to both TeamHoursPanel and ScheduleGrid (not TeamContext, per
  the original decision below)
- isHourInRange(range, hour) extracted into scheduleTime.ts, handling overnight
  wraparound - shared by both ScheduleGrid's member rows and the new overlap row
- Overlap row added to ScheduleGrid: renders only when selectedIds is non-empty,
  lit for an hour only when every selected member's hourRange covers it
- Matches the component-shape decisions recorded below (no new backend route,
  open to any authenticated user, one shared grid template for pixel alignment)

## COMPLETED — scheduleTime.ts extraction (7/15/2026)
- Pulled the inline dayjs timezone-conversion block out of ScheduleGrid.tsx
  (was lines ~77-92) into `resolveHourRangeInViewerTz`, a pure function in
  new file frontend/src/utils/scheduleTime.ts
- Also extracted the "find this member's current shift" lookup into
  `getCurrentShiftForMember` in the same file - was inline in ScheduleGrid
  as a `.filter()` + `.find()` pair
- Both are plain functions (no hooks, no context) so any component can
  import and call them directly - this is what makes them reusable for
  the Overlap Finder below without needing shared state/context
- Replaced the old -1/-1/false sentinel values with a single
  `HourRange | null` return - null means "nothing to render," no magic
  numbers to remember at call sites
- Fixed a type-narrowing gap this surfaced: currentShift is now checked
  directly before .startTime/.endTime access in the JSX, instead of
  relying on isStartOfShift (which only narrows hourRange) to imply it
- No behavior change - verified via manual script run against real
  dayjs output (overnight shift, no-shift, and cross-timezone cases)
- ScheduleGrid.tsx no longer imports dayjs directly

## DECISIONS MADE, NOT YET IMPLEMENTED

### Recurring shifts: day-of-week, not date-based — ALL IMPLEMENTED (7/24)
Kept as the decisions log / rationale for why the shipped design looks the
way it does. Nothing below is outstanding.
- Standing shifts will key off day-of-week (e.g. "Monday: 9-5") instead of
  a single date-based record, so a member isn't forced to work identical
  hours every day
- Deliberately NOT building a "week's worth of dated shifts" feature -
  rejected in favor of day-of-week recurrence, which needs no bulk-create
  flow and no "view next week" navigation
- No visual weekly view planned - ScheduleGrid keeps showing one day at a
  time; which shift displays just resolves automatically based on the
  current day of week
- This is a real schema fork, not a UI-only change: WorkShift.date makes
  sense for breaks (genuinely one-off, dated events) but not for standing
  shifts (recurring, not tied to a calendar date). The two record types
  will need to be modeled differently
- Who can edit: leaning toward self-service by default (member edits their
  own recurring hours) with admin able to override anyone's - same
  ownership-check shape as the existing PATCH /:id/status route (trust the
  JWT's teamMemberId, not a client-supplied id) - not finalized
- getCurrentShiftForMember (see above) is now the single place this
  rework needs to touch - its internals will change from "grab the first
  shift record" to "resolve today's day-of-week + layer any break on top,"
  and every consumer (ScheduleGrid, TeamHoursPanel, overlap logic) picks
  up the new behavior automatically

- OPEN QUESTIONS - RESOLVED 7/21/2026 (decisions below, ready for #1):
  - "Day off" representation: EXPLICIT off record, via an isOff boolean
    flag on the standing-shift record (NOT null start/end times). The flag
    lets getCurrentShiftForMember cleanly distinguish three states:
    on-shift (record with times), off-today (record, isOff:true), and
    never-set-up (no record for that weekday). Null times would blur the
    last two back together, defeating the point.
  - Where hours are set: per-member hours page, 7 weekday rows, each a
    time range or an "off" toggle. Self-service at /profile/hours; admin
    reaches the same page for anyone at /members/:id/hours. (Confirmed -
    no real alternative.)
  - Self-service edit route: single PUT /api/team-members/:id/hours that
    REPLACES the whole week at once (array of 7), not per-day PATCHes -
    matches the "save my week" UX and avoids partial-update races. Auth
    mirrors PATCH /:id/status: :id must equal the JWT's teamMemberId
    unless the caller is admin. Breaks stay on the existing dated
    /api/work-shifts routes - this route does not touch them.
  - Initial seeding: SELF-SERVICE. Hours start empty at member creation
    (AddTeamMemberForm stays lightweight, no weekday grid). Members fill
    their own week after first login. Deliberately leans on the
    "never set up" state, which the explicit-off decision makes cleanly
    queryable (zero standing-shift records == unset).
  - First-run gate (new, from the seeding decision): on login, if the
    member has zero standing-shift records, show a DISMISSIBLE prompt.
    Yes -> route to /profile/hours. No -> continue to the normal grid
    with their hours rendered as "unset." Non-blocking by design - lives
    as a conditional in the existing ProtectedRoute redirect spot, reuses
    the hours page (no separate page).
  - Persistent "set your hours" CTA (new): standing, obvious affordance on
    the member's OWN row in TeamStatusSidebar - the row already keys off
    AuthContext.teamMemberId, so "you, and unset" is a condition it
    already knows. Prefer a highlighted/interactive "Hours not set" chip
    (e.g. amber) over literal flashing; if any motion is used, respect
    prefers-reduced-motion.

- MIGRATION (falls out of the schema fork): existing members each have
  one date-based WorkShift. Small dev DB, so simplest is to derive
  dayOfWeek from the old shift's date, seed those hours Mon-Fri with
  weekends isOff, then drop the old date-based records. Wipe-and-re-enter
  is also acceptable given how little data there is. Make it a deliberate
  call in the script, don't let it guess.

### Breaks stay separate from recurring shifts — SUPERSEDED 7/25
Kept for the reasoning trail. The conclusion below no longer holds because
the FEATURE changed, not because the logic was wrong: ad-hoc breaks are cut
(redundant with 'away' once polling makes 'away' visible), and what replaced
them is a standing weekly lunch, which is a schedule fact and therefore does
recur. See the decisions section at the top.
- Confirmed: breaks can't be recurring (a break is "something happening
  today," not a pattern), so they stay as dated, one-off WorkShift records
  even after standing shifts move to day-of-week recurrence
- Practical effect: ScheduleGrid will need to resolve TWO things per
  member per day - "today's recurring shift" and "today's break(s), if
  any" - and combine them, instead of finding one shift and stopping
  (STILL TRUE in shape - it's a lunch window rather than a break record,
  and the stitch still happens in getCurrentShiftForMember)

### Live Availability Sidebar: 4-state status, not binary
- PRD calls for Active / Away / Do Not Disturb / Offline
- IN PROGRESS (started 7/18): TeamMember.isAvailable Boolean is being
  replaced with a status enum ('active' | 'away' | 'dnd' | 'offline'),
  default 'active'. Manual picker only offers active/away/dnd.
- OFFLINE IS DERIVED, NOT MANUAL: a member shows offline automatically
  when they are not on shift at their own current local time. It is
  computed per-member from that member's own schedule + own local clock,
  independent of who is viewing. So the manual picker deliberately omits
  offline. This "on shift right now" check is deferred to #1 below -
  see the note there - because it needs reliable current-shift
  resolution, which getCurrentShiftForMember does not yet provide.
- The combined model (derived offline overrides stored manual when off
  shift; on shift shows stored status, default active) is the goal;
  we're building the manual layer now and the derived-offline layer with #1.
- Status editing identity: the picker's "can I edit this?" check is wired
  to real auth (AuthContext.teamMemberId), NOT the vestigial viewerId
  dropdown. Backend already enforces this via the JWT. This resolves half
  of the "two sources of who am I" tech-debt item in one pass.

### Meeting Overlap Finder: component shape + access — IMPLEMENTED, see COMPLETED above
- No new context needed - the shared timezone/shift-lookup logic already
  lives in scheduleTime.ts as plain functions, callable from anywhere
- Selection state (which members are checked) lives in ScheduleView.tsx
  (the existing shared parent of ScheduleGrid + TeamStatusSidebar, used by
  both /dashboard and /admin/schedule) as local useState, passed down as
  props - not lifted into TeamContext, since it's local UI state for this
  view, not team data other screens need
- Two new/changed components under ScheduleView:
  - TeamHoursPanel (new): checkbox per member + their hours converted to
    the viewer's timezone (reuses resolveHourRangeInViewerTz +
    getCurrentShiftForMember) - doubles as both the roster display and
    the multi-select control, one component instead of two
  - ScheduleGrid (changed): gains one additional row rendered the same
    way as a member row, colored where every selected member is active -
    chosen over full-height vertical bands spanning all rows, since a
    row shares the exact same CSS grid track as the member rows and is
    guaranteed pixel-aligned, whereas bands would need to independently
    replicate ScheduleGrid's column math (120px name col, 55px/hour,
    2px gap) and risk drifting out of alignment if that math ever changes
- Access: no role restriction - open to any authenticated user, not just
  admins. Reasoning: this reads data that's already visible to every
  logged-in member (no new backend route, no new exposure - confirmed
  frontend-only in the original spec), and any member might want to check
  overlap with a colleague, not just a coordinator scheduling a group

