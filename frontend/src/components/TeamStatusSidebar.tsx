import { useTeam } from '../context/TeamContext';
import { getCurrentShiftForMember } from '../utils/scheduleTime';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TeamStatusSidebar = () => {
  const { members, shifts, toggleAvailability, viewerId, setViewer, viewerTimezone } = useTeam();

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
          // Highlights the card belonging to whichever member is currently
          // selected in the viewer dropdown above
          const isSelf = member._id === viewerId;

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
                {/* Color-coded availability pill - green/red styling driven
                    entirely by member.isAvailable */}
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium border ${
                    member.isAvailable
                      ? 'bg-green-500/15 text-green-400 border-green-500'
                      : 'bg-red-500/15 text-red-400 border-red-500'
                  }`}
                >
                  {member.isAvailable ? 'Available' : 'Away'}
                </span>
              </div>

              {/* Only the selected viewer can toggle their own availability -
                  other members' cards show status but no action button */}
              {isSelf && (
                <button
                  onClick={() => toggleAvailability(member._id, member.isAvailable)}
                  className={`w-full mt-2 py-1 rounded text-xs font-bold text-white transition-colors ${
                    member.isAvailable
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-green-600 hover:bg-green-500'
                  }`}
                >
                  Set as {member.isAvailable ? '🔴 Away' : '🟢 Available'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeamStatusSidebar;