import { useTeam } from '../context/useTeam';
import { getCurrentShiftForMember, resolveHourRangeInViewerTz, formatHourRange } from '../utils/scheduleTime';

interface TeamHoursPanelProps {
  selectedIds: string[];
  onToggle: (id: string) => void;
}

// Doubles as both the roster display and the Overlap Finder's multi-select
// control - one component instead of two, since the checkbox and the "what
// are this person's hours" label are the same row either way.
// Selection state itself lives in ScheduleView (the shared parent), not here
// or in TeamContext - see nextSteps.md for why.
const TeamHoursPanel = ({ selectedIds, onToggle }: TeamHoursPanelProps) => {
  // displayTimezone, not viewerTimezone - these chips are a summary of the
  // same hours the grid draws, so they have to follow a timezone preview or
  // the two would disagree on screen. Nothing here writes, so following it is
  // safe (see the split comment in TeamContext).
  const { members, recurringShifts, displayTimezone } = useTeam();

  return (
    // Now sits above ScheduleGrid in the wide main column (moved out of the
    // 280px sidebar), so chips laid out with flex-wrap make better use of
    // the width than the original vertical list did.
    <div className="w-full bg-surface border-b border-line text-white p-4 box-border mb-2">
      <h3 className="text-sm font-semibold mb-3 text-ink">Compare Availability</h3>

      <div className="flex flex-wrap gap-2">
        {members.map(member => {
          // Same lookup ScheduleGrid uses for its rows - reused here so the
          // hours shown in this checklist always match what the grid renders.
          const resolution = getCurrentShiftForMember(member._id, recurringShifts, member.timezone);
          const hourRange = resolveHourRangeInViewerTz(resolution, member.timezone, displayTimezone);
          const isChecked = selectedIds.includes(member._id);

          return (
            <label
              key={member._id}
              // max-w-full stops a pill from being wider than the row it wraps
              // in, which is what clipped the hour label to "7AM–3P" on a
              // phone: the flex container wrapped, but an individual pill
              // could still overflow it and get cut at the edge.
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer text-sm transition-colors max-w-full ${
                isChecked
                  ? 'bg-brand/20 border-brand text-white'
                  : 'bg-card border-line text-ink hover:border-line-strong'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(member._id)}
                className="accent-brand shrink-0"
              />
              {/* The NAME truncates and the hours don't. If something has to
                  give inside a narrow pill it should be the name - a clipped
                  name is still recognisable next to a checkbox, where a
                  clipped time ("3P") is just wrong. */}
              <span className="truncate min-w-0">{member.name}</span>
              <span className="text-xs text-ink-faint whitespace-nowrap shrink-0">
                {/* off / unset have no hourRange, so distinguish them here
                    rather than showing a generic "No shift" for both. */}
                {resolution.state === 'off'
                  ? 'Off'
                  : resolution.state === 'unset'
                    ? 'Not set'
                    : formatHourRange(hourRange)}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default TeamHoursPanel;
