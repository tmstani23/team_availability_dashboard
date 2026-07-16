import { useTeam } from '../context/TeamContext';
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
  const { members, shifts, viewerTimezone } = useTeam();

  return (
    // Now sits above ScheduleGrid in the wide main column (moved out of the
    // 280px sidebar), so chips laid out with flex-wrap make better use of
    // the width than the original vertical list did.
    <div className="w-full bg-zinc-900 border-b border-zinc-700 text-white p-4 box-border mb-2">
      <h3 className="text-sm font-semibold mb-3 text-zinc-300">Compare Availability</h3>

      <div className="flex flex-wrap gap-2">
        {members.map((member: any) => {
          // Same lookup ScheduleGrid uses for its rows - reused here so the
          // hours shown in this checklist always match what the grid renders.
          const currentShift = getCurrentShiftForMember(member._id, shifts);
          const hourRange = resolveHourRangeInViewerTz(currentShift, member.timezone, viewerTimezone);
          const isChecked = selectedIds.includes(member._id);

          return (
            <label
              key={member._id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer text-sm transition-colors ${
                isChecked
                  ? 'bg-violet-600/20 border-violet-500 text-white'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(member._id)}
                className="accent-violet-500 shrink-0"
              />
              <span>{member.name}</span>
              <span className="text-xs text-zinc-500 whitespace-nowrap">
                {formatHourRange(hourRange)}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

export default TeamHoursPanel;
