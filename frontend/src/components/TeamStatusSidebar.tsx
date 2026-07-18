import { useTeam } from '../context/TeamContext';
import { useAuth } from '../context/AuthContext';
import { getCurrentShiftForMember } from '../utils/scheduleTime';
import { STATUS_META, SETTABLE_STATUSES } from '../utils/status';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TeamStatusSidebar = () => {
  const { members, shifts, setStatus, viewerId, setViewer, viewerTimezone } = useTeam();
  // Who is ACTUALLY logged in (real auth), as opposed to viewerId which only
  // simulates whose timezone the grid previews. Editing your own status keys
  // off this - it must match the identity the backend trusts from the JWT.
  const { teamMemberId } = useAuth();

  // Converts a member's timezone into their local clock time. Falls back to
  // the browser's local time if the timezone string is invalid, so a bad
  // value never crashes the render.
  const getLocalTime = (tz: string) => {
    try {
      return dayjs().tz(tz).format('hh:mm A');
    } catch {
      return dayjs().format('hh:mm A');
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
          {members.map((m: any) => (
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
        {members.map((member: any) => {
          // True only for the actually logged-in member. Drives both the
          // "(You)" marker and whether the status picker is shown - you can
          // only set your own status, matching the backend's JWT check.
          // Note: this is real-auth identity, NOT the viewerId simulation.
          const isSelf = member._id === teamMemberId;

          // Their registered shift, in THEIR OWN local time - no timezone
          // conversion here, unlike the grid/chips. startTime/endTime are
          // already stored as that member's own wall-clock HH:mm, so this
          // answers "what does their day actually look like to them"
          // without needing to flip the viewer dropdown to become them.
          const currentShift = getCurrentShiftForMember(member._id, shifts);

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
                  {currentShift && (
                    <div className="text-xs text-zinc-500">
                      Working {currentShift.startTime}–{currentShift.endTime}
                    </div>
                  )}
                </div>
                {/* Color-coded status pill. Label + colors come from the
                    shared STATUS_META map, so this and the admin card can't
                    drift apart. Fallback to 'offline' guards against a member
                    whose status somehow isn't set (e.g. pre-migration data). */}
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium border ${
                    (STATUS_META[member.status] ?? STATUS_META.offline).pill
                  }`}
                >
                  {(STATUS_META[member.status] ?? STATUS_META.offline).label}
                </span>
              </div>

              {/* Only the logged-in member can set their own status - other
                  members' cards show the pill but no picker. Four states have
                  no single "opposite," so this is a row of explicit choices
                  rather than one toggle. offline isn't here: it's derived
                  from schedule, not hand-set (see SETTABLE_STATUSES). */}
              {isSelf && (
                <div className="mt-2 grid grid-cols-3 gap-1">
                  {SETTABLE_STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => setStatus(member._id, s)}
                      // Highlight the current choice with its own status color;
                      // the others stay neutral until clicked.
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeamStatusSidebar;