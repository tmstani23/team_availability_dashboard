import { Link } from 'react-router-dom';
import { useTeam } from '../context/useTeam';
import { useAuth } from '../context/useAuth';
import {
  getCurrentShiftForMember,
  getScheduleState,
  meetingsForMember,
  isMeetingInProgress,
  formatTimezoneLabel,
  formatWallClock,
} from '../utils/scheduleTime';
import { STATUS_META, SETTABLE_STATUSES, resolveDisplayStatus } from '../utils/status';
import { HEARTBEAT_STALE_MS } from '../hooks/useRefreshTick';
import type { TeamMember } from '../types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// First letters of the first two words of a name ("Sarah Chen" -> "SC"), for
// the identity block's avatar. Falls back to one letter for a single-word
// name and to '?' for an empty one, so the circle is never blank.
const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0] ?? '')
    .join('')
    .toUpperCase() || '?';

const TeamStatusSidebar = () => {
  const { members, recurringShifts, meetings, setStatus, viewerTimezone, browserTimezone, now } = useTeam();
  // Who is ACTUALLY logged in. Drives both the status picker (you can only set
  // your own) and the identity block below - it must match the identity the
  // backend trusts from the JWT. `role` only decides the WORDING of the
  // timezone-mismatch hint, since who can fix a stored zone differs by role.
  const { teamMemberId, role } = useAuth();

  // The logged-in member's own record, for the identity block. Undefined while
  // members are still loading, and legitimately undefined forever for a badge
  // with no linked teamMemberId - the block degrades to just the clock rather
  // than disappearing, since the grid's zone still needs naming either way.
  const loggedInMember = members.find(m => m._id === teamMemberId);

  // Stored schedule identity vs the clock on this device. Compared as IANA
  // STRINGS, never offsets: two zones can share an offset, and one zone changes
  // its own offset twice a year, so an offset comparison would flash a false
  // mismatch at every DST changeover.
  const storedZoneDiffers = Boolean(loggedInMember && loggedInMember.timezone !== viewerTimezone);

  // Converts a member's timezone into their local clock time, tagged with the
  // zone it's in ("10:41 AM · Sydney"). Without the tag it's a bare number -
  // you can read that someone says 10:41 but not whether they're an hour ahead
  // of you or fifteen, which is the actual question being asked of this row.
  //
  // Reads `now` from context rather than calling dayjs() here, so the clock
  // ticks with the poll on a tab left open. (It happened to update anyway,
  // since a changing `now` re-renders this component - but that's an accident
  // of an unrelated dependency, not something to rely on.)
  //
  // Falls back to the browser's local time UNLABELLED if the timezone string
  // is invalid, so a bad value never crashes the render. Dropping the label in
  // that case is the point: the time being shown is then the viewer's own, and
  // tagging it with the member's intended city would confidently mislabel it.
  const getLocalTime = (tz: string) => {
    const zone = formatTimezoneLabel(tz);
    try {
      // h:mm, not hh:mm - "2:41 PM" rather than "02:41 PM". The leading zero
      // was only ever buying column stability, and .tnum on the element
      // already does that by making every digit the same width.
      const clock = now.tz(tz).format('h:mm A');
      return zone ? `${clock} · ${zone}` : clock;
    } catch {
      return now.format('h:mm A');
    }
  };

  return (
    // Sits in-flow inside the w-[280px] column ScheduleView reserves for it.
    // h-full stretches it to match ScheduleGrid's height (flex row default
    // align-items: stretch). Back to sole occupant of this column now that
    // TeamHoursPanel has moved to the main column above ScheduleGrid.
    // The divider follows the layout: a TOP border when this sits stacked
    // under the grid, a LEFT border once it's the right-hand column. A left
    // border on a stacked block draws a stray vertical line down the page.
    // overflow-y-auto only applies once it's a column - when stacked it's in
    // the normal page flow and an inner scroll area would trap the scroll.
    <div className="w-full lg:h-full bg-surface border-t lg:border-t-0 lg:border-l border-line text-white p-6 box-border lg:overflow-y-auto">
      {/* IDENTITY BLOCK - replaced the "Simulating Active User" dropdown.
          Not simply a deletion: this corner answers "whose clock is this grid
          in?", and the grid stays timezone-converted after the picker goes, so
          the question outlives the control. A static block answers it honestly
          where a picker implied you could change it - which auth has forbidden
          since 7/18 anyway.

          The name/avatar render only when we can resolve the logged-in member;
          the CLOCK LINE always renders, because that's the part the grid
          depends on and an admin badge with no linked teamMemberId still needs
          to know which zone they're reading. */}
      <div className="mb-6 border-b border-line pb-4">
        {/* Avatar + name only. The clock deliberately does NOT sit in this row:
            next to a 36px avatar it had ~150px to work with and truncated to
            "(this devi...". On its own line below it gets the block's full
            width and wraps instead of clipping. */}
        {loggedInMember && (
          <div className="flex items-center gap-3">
            {/* Neutral, not brand. `brand` means "you can interact with this"
                (see index.css) and an avatar is decoration - painting it violet
                would advertise a click that doesn't exist. */}
            <div className="shrink-0 w-9 h-9 rounded-full bg-line border border-line-strong flex items-center justify-center text-xs font-semibold text-ink">
              {initials(loggedInMember.name)}
            </div>
            <div className="font-bold text-sm truncate min-w-0">{loggedInMember.name}</div>
          </div>
        )}

        {/* The zone the WHOLE GRID is rendered in - always rendered, even
            without a resolvable member, since the grid's zone still needs
            naming. No `truncate`: a long city ("Buenos Aires") should wrap to
            a second line rather than clip.

            "(this device)" appears ONLY alongside a mismatch. The caption is
            a contrast - it's what makes the amber line below read as two
            different facts rather than a contradiction. With nothing to
            contrast against it answers a question nobody asked, and it was
            the sole cause of the overflow. Also gated on the browser actually
            having answered: if we fell back to the stored zone, calling it the
            device's would be a lie (see browserTimezone in TeamContext). */}
        <div className={`text-xs text-ink-muted tnum ${loggedInMember ? 'mt-2' : ''}`}>
          {getLocalTime(viewerTimezone)}
          {storedZoneDiffers && browserTimezone === viewerTimezone && (
            <span className="text-ink-faint"> (this device)</span>
          )}
        </div>

        {/* Names the disagreement rather than hiding or arbitrating it. The
            browser wins for VIEWING, but the stored zone is schedule identity -
            it decides when everyone else sees this person as on shift - so a
            stale one misreports them to the whole team until someone corrects
            it. Surfacing it is what stops "browser wins" from being "browser
            wins silently".

            Compared as IANA STRINGS, never offsets: two zones can share an
            offset, and one zone changes its own offset twice a year, so an
            offset comparison would flash a false mismatch at every DST change.

            Only ever shown here, never on another member's roster row - the
            browser zone is a fact about THIS device, so the disagreement is
            undetectable for anyone else. Wording is role-aware because who can
            fix it differs: timezone is an admin-editable profile field. */}
        {storedZoneDiffers && loggedInMember && (
          <div className="mt-2 text-[11px] text-away leading-snug">
            Your profile says {formatTimezoneLabel(loggedInMember.timezone)}
            {role === 'admin'
              ? ' — update it in Manage if that is wrong.'
              : ' — ask an admin to update it if that is wrong.'}
          </div>
        )}
      </div>

      <h3 className="mt-0 mb-5 text-lg font-semibold">Live Availability</h3>

      {/* Roster list - one card per team member, sorted in whatever order
          they came back from the API (no client-side sort applied) */}
      <div className="flex flex-col gap-4">
        {members.map((member: TeamMember) => {
          // True only for the actually logged-in member. Drives both the
          // "(You)" marker and whether the status picker is shown - you can
          // only set your own status, matching the backend's JWT check.
          const isSelf = member._id === teamMemberId;

          // Today's standing shift, resolved by the member's own weekday. Shown
          // in their own local time (no viewer-tz conversion, unlike the grid) -
          // this answers "what does their day look like to them." `now` comes
          // from useRefreshTick via context, ticking on each poll, so this
          // re-evaluates on an open tab instead of freezing at mount time.
          const resolution = getCurrentShiftForMember(member._id, recurringShifts, member.timezone, now);

          // What we know about their schedule right now, then what that means
          // for the pill. displayStatus can differ from member.status - being
          // off shift (or having gone quiet - the heartbeat layer) derives
          // 'offline' over whatever they last set.
          const scheduleState = getScheduleState(resolution, member.timezone, now);

          // Whether a booked meeting is running right now. Pure instant
          // comparison - notably the only line in this component that needs no
          // timezone at all, because both sides are instants rather than wall
          // clocks. `meetings` only covers the viewer's local day, which is
          // fine: a meeting in progress NOW is on the viewer's today by
          // definition.
          const currentMeeting = meetingsForMember(meetings, member._id)
            .find(m => isMeetingInProgress(m, now));

          const lastSeenAtMs = member.lastSeenAt ? new Date(member.lastSeenAt).getTime() : undefined;
          const displayStatus = resolveDisplayStatus(
            member.status,
            scheduleState,
            Boolean(currentMeeting),
            lastSeenAtMs,
            now.valueOf(),
            HEARTBEAT_STALE_MS
          );
          // True when the schedule is overriding a choice they actually made.
          // Only worth surfacing on your own row, where clicking a status
          // button otherwise looks like it silently did nothing.
          const isOverridden = displayStatus !== member.status && !!member.status;

          return (
            <div
              key={member._id}
              className={`bg-card p-3 rounded-md border ${
                isSelf ? 'border-brand' : 'border-line'
              }`}
            >
              {/* Top row: identity info on the left, status pill on the right.
                  min-w-0 on the left column is load-bearing. A flex child's
                  default min-width is auto, meaning it refuses to shrink below
                  its content - so with a long name AND a long pill ("In a
                  meeting"), the pill was the thing that gave way and wrapped
                  onto two lines. min-w-0 lets the name truncate instead, which
                  is the right one to sacrifice: a clipped name is still
                  recognisable, a wrapped pill just looks broken. */}
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">
                    {member.name}{' '}
                    {isSelf && <span className="text-brand-hover text-xs">(You)</span>}
                  </div>
                  <div className="text-xs text-ink-muted truncate">{member.role}</div>
                  <div className="text-xs text-ink-faint tnum">🕒 {getLocalTime(member.timezone)}</div>
                  {/* Standing hours for today in the member's own local time.
                      'unset' shows nothing here - the "set your hours" prompt
                      for that case lands with the first-run gate (nextSteps). */}
                  {resolution.state === 'working' && (
                    <div className="text-xs text-ink-faint tnum">
                      {/* formatWallClock is a RENDER-EDGE formatter - resolution
                          still holds the stored 24-hour strings, and nothing
                          here writes them back, so the "HH:mm" contract with the
                          API is untouched. */}
                      Working {formatWallClock(resolution.startTime)}–{formatWallClock(resolution.endTime)}
                    </div>
                  )}
                  {resolution.state === 'off' && (
                    <div className="text-xs text-ink-faint">Off today</div>
                  )}
                  {/* Naming the meeting turns "In a meeting" from a state into
                      an answer - the next question after seeing that pill is
                      always "which one, and how long." Shown regardless of
                      whether the pill actually says 'meeting': someone off
                      shift still reads as offline (see resolveDisplayStatus),
                      and this line is what explains the sky block sitting
                      on their grid row. */}
                  {currentMeeting && (
                    <div className="text-xs text-booked">
                      In: {currentMeeting.title}
                    </div>
                  )}
                  {/* Unset needs to be VISIBLE for everyone, not just you -
                      an empty row otherwise reads as "not working today,"
                      which is a different fact entirely. What differs by
                      person is only whether it's actionable: your own row
                      gets the amber link to go fix it (the standing CTA once
                      FirstRunHoursGate has been dismissed), everyone else's
                      gets the same information as a plain label. */}
                  {resolution.state === 'unset' && (
                    isSelf ? (
                      <Link
                        to="/profile/hours"
                        className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium border bg-away/15 text-away border-away hover:bg-away/25 transition-colors"
                      >
                        Hours not set — set now
                      </Link>
                    ) : (
                      <div className="text-xs text-away/80">Hours not set</div>
                    )
                  )}
                </div>
                {/* Color-coded status pill. Label + colors come from the
                    shared STATUS_META map, so this and the admin card can't
                    drift apart. Fallback to 'offline' guards against a member
                    whose status somehow isn't set (e.g. pre-migration data). */}
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium border whitespace-nowrap shrink-0 ${
                    STATUS_META[displayStatus].pill
                  }`}
                >
                  {STATUS_META[displayStatus].label}
                </span>
              </div>

              {/* Only the logged-in member can set their own status - other
                  members' cards show the pill but no picker. Four states have
                  no single "opposite," so this is a row of explicit choices
                  rather than one toggle. offline isn't here: it's derived
                  from schedule, not hand-set (see SETTABLE_STATUSES). */}
              {isSelf && (
                <>
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {SETTABLE_STATUSES.map(s => (
                      <button
                        key={s}
                        onClick={() => setStatus(member._id, s)}
                        // Highlights what they STORED (member.status), not the
                        // derived displayStatus - this row is "what did I
                        // choose," and showing the derived value here would
                        // make their actual choice invisible.
                        className={`py-1 rounded-md text-xs font-medium border transition-colors ${
                          member.status === s
                            ? STATUS_META[s].pill
                            : 'bg-line text-ink border-transparent hover:bg-line-strong'
                        }`}
                      >
                        {STATUS_META[s].short}
                      </button>
                    ))}
                  </div>
                  {/* Without this, picking a status while the schedule is
                      overriding you looks like the button did nothing - the
                      pill above doesn't change. The wording has to name the
                      ACTUAL override, though: telling someone in a meeting
                      that they're "outside your hours" would be a confidently
                      wrong explanation of a correct display. */}
                  {isOverridden && (
                    <div className="mt-1.5 text-[11px] text-ink-faint leading-snug">
                      {displayStatus === 'meeting'
                        ? `In a meeting — showing that instead. Your ${STATUS_META[member.status].label} setting applies once it ends.`
                        : displayStatus === 'break'
                        ? `At lunch — showing that instead. Your ${STATUS_META[member.status].label} setting applies once you're back.`
                        : `Outside your hours — showing offline. Your ${STATUS_META[member.status].label} setting applies once you're back on shift.`}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeamStatusSidebar;