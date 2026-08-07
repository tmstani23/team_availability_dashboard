import { Link } from 'react-router-dom';
import { useTeam } from '../context/useTeam';
import { useAuth } from '../context/useAuth';
import {
  getCurrentShiftForMember,
  getScheduleState,
  meetingsForMember,
  isMeetingInProgress,
  formatTimezoneLabel,
} from '../utils/scheduleTime';
import { STATUS_META, SETTABLE_STATUSES, resolveDisplayStatus } from '../utils/status';
import { HEARTBEAT_STALE_MS } from '../hooks/useRefreshTick';
import type { TeamMember } from '../types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TeamStatusSidebar = () => {
  const { members, recurringShifts, meetings, setStatus, viewerId, setViewer, viewerTimezone, now } = useTeam();
  // Who is ACTUALLY logged in (real auth), as opposed to viewerId which only
  // simulates whose timezone the grid previews. Editing your own status keys
  // off this - it must match the identity the backend trusts from the JWT.
  const { teamMemberId } = useAuth();

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
      const clock = now.tz(tz).format('hh:mm A');
      return zone ? `${clock} · ${zone}` : clock;
    } catch {
      return now.format('hh:mm A');
    }
  };

  return (
    // Sits in-flow inside the w-[280px] column ScheduleView reserves for it.
    // h-full stretches it to match ScheduleGrid's height (flex row default
    // align-items: stretch). Back to sole occupant of this column now that
    // TeamHoursPanel has moved to the main column above ScheduleGrid.
    <div className="w-full h-full bg-zinc-900 border-l border-zinc-700 text-white p-6 box-border overflow-y-auto">
      {/* Viewer selector - lets you pick which team member's perspective
          you're viewing the dashboard as (see viewerId in TeamContext) */}
      <div className="mb-6 border-b border-zinc-700 pb-4">
        <label className="block text-xs text-zinc-500 mb-2">
          Simulating Active User:
        </label>
        <select
          value={viewerId || ''}
          onChange={(e) => setViewer(e.target.value)}
          className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-2 py-1.5 text-sm transition-colors focus:outline-none focus:border-violet-500 hover:border-zinc-600"
        >
          {members.map(m => (
            <option key={m._id} value={m._id}>{m.name}</option>
          ))}
        </select>
        <div className="text-xs text-zinc-500 mt-2">
          Your local time: {getLocalTime(viewerTimezone)}
        </div>
      </div>

      <h3 className="mt-0 mb-5 text-lg font-semibold">Live Availability</h3>

      {/* Roster list - one card per team member, sorted in whatever order
          they came back from the API (no client-side sort applied) */}
      <div className="flex flex-col gap-4">
        {members.map((member: TeamMember) => {
          // True only for the actually logged-in member. Drives both the
          // "(You)" marker and whether the status picker is shown - you can
          // only set your own status, matching the backend's JWT check.
          // Note: this is real-auth identity, NOT the viewerId simulation.
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
              className={`bg-zinc-800 p-3 rounded-md border ${
                isSelf ? 'border-blue-500' : 'border-zinc-700/60'
              }`}
            >
              {/* Top row: identity info on the left, status pill on the right */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-sm">
                    {member.name}{' '}
                    {isSelf && <span className="text-blue-400 text-xs">(You)</span>}
                  </div>
                  <div className="text-xs text-zinc-400">{member.role}</div>
                  <div className="text-xs text-zinc-500">🕒 {getLocalTime(member.timezone)}</div>
                  {/* Standing hours for today in the member's own local time.
                      'unset' shows nothing here - the "set your hours" prompt
                      for that case lands with the first-run gate (nextSteps). */}
                  {resolution.state === 'working' && (
                    <div className="text-xs text-zinc-500">
                      Working {resolution.startTime}–{resolution.endTime}
                    </div>
                  )}
                  {resolution.state === 'off' && (
                    <div className="text-xs text-zinc-500">Off today</div>
                  )}
                  {/* Naming the meeting turns "In a meeting" from a state into
                      an answer - the next question after seeing that pill is
                      always "which one, and how long." Shown regardless of
                      whether the pill actually says 'meeting': someone off
                      shift still reads as offline (see resolveDisplayStatus),
                      and this line is what explains the violet block sitting
                      on their grid row. */}
                  {currentMeeting && (
                    <div className="text-xs text-violet-300">
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
                        className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium border bg-amber-500/15 text-amber-400 border-amber-500 hover:bg-amber-500/25 transition-colors"
                      >
                        Hours not set — set now
                      </Link>
                    ) : (
                      <div className="text-xs text-amber-400/80">Hours not set</div>
                    )
                  )}
                </div>
                {/* Color-coded status pill. Label + colors come from the
                    shared STATUS_META map, so this and the admin card can't
                    drift apart. Fallback to 'offline' guards against a member
                    whose status somehow isn't set (e.g. pre-migration data). */}
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium border ${
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
                        className={`py-1 rounded text-xs font-medium border transition-colors ${
                          member.status === s
                            ? STATUS_META[s].pill
                            : 'bg-zinc-700 text-zinc-300 border-transparent hover:bg-zinc-600'
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
                    <div className="mt-1.5 text-[11px] text-zinc-500 leading-snug">
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