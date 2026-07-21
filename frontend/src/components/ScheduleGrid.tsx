import { useEffect } from 'react';
import { useTeam } from '../context/TeamContext';
import { resolveHourRangeInViewerTz, getCurrentShiftForMember, isHourInRange, formatHourLabel } from '../utils/scheduleTime';

interface ScheduleGridProps {
  selectedIds: string[];
}

const ScheduleGrid = ({ selectedIds }: ScheduleGridProps) => {
  // 1. Read live synchronizing records directly out of our global application context hook stream
  const { members, recurringShifts, loading, viewerTimezone } = useTeam();

  // Hours from 6:00 AM to 5:00 AM next day
  const hours = Array.from({ length: 24 }, (_, i) => (i + 6) % 24);

  // Auto-scroll to typical work hours (around 8AM) on load
  useEffect(() => {
    const gridContainer = document.querySelector('.schedule-grid-container');
    if (gridContainer) {
      gridContainer.scrollLeft = 360; // Approximate scroll to 8AM column
    }
  }, []);

  // Safety protection barrier while data collections initialize on app startup
  if (loading) return <div className="text-white p-4">Loading schedule data...</div>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-white mb-4">Daily Schedule Matrix</h2>
      <p className="text-xs text-zinc-400">Viewer TZ: {viewerTimezone}</p>

      <div className="schedule-grid-container overflow-x-auto max-w-full pb-4">
        {(() => {
          const columnWidth = '55px';
          const gridGap = '2px';
          const gridTemplate = `120px repeat(${hours.length}, ${columnWidth})`;

          // Resolve each member's shift + hourRange ONCE here, instead of
          // recomputing it separately for the member rows and the overlap
          // row below - both now read from this same array.
          const memberRows = members.map((member: any) => {
            // Resolve today's standing shift by the member's OWN weekday, then
            // convert to the viewer's tz. off / unset yield a null range, so
            // those rows render empty.
            const resolution = getCurrentShiftForMember(member._id, recurringShifts, member.timezone);
            const hourRange = resolveHourRangeInViewerTz(resolution, member.timezone, viewerTimezone);
            return { member, hourRange };
          });

          // Only checked members (from TeamHoursPanel) count toward overlap.
          // No selection = no overlap row rendered at all.
          const selectedRows = memberRows.filter(row => selectedIds.includes(row.member._id));

          return (
            <div
              style={{ minWidth: `calc(120px + (${hours.length} * 55px) + (${hours.length} * 2px))` }}
              className="p-4 mx-auto pl-8"
            >
              {/* Scrollable header - centered with padding */}
              <div
                className="grid mx-auto pl-8"
                style={{ gridTemplateColumns: gridTemplate, gap: gridGap, marginBottom: '12px', paddingBottom: '8px' }}
              >
                <div></div>
                {hours.map(hour => (
                  <div key={hour} className="text-center font-bold text-xs whitespace-nowrap text-white">
                    {hour}:00
                  </div>
                ))}
              </div>

              {/* Team Member Rows - centered with padding */}
              {memberRows.map(({ member, hourRange }) => (
                <div
                  key={member._id}
                  className="grid mx-auto pl-8"
                  style={{ gridTemplateColumns: gridTemplate, gap: gridGap, margin: '6px 0', alignItems: 'center' }}
                >
                  <div className="font-bold pr-2 whitespace-nowrap overflow-hidden text-ellipsis text-white">
                    {member.name}
                  </div>

                  {hours.map(hour => {
                    const isHourActive = isHourInRange(hourRange, hour);
                    const isStartOfShift = hourRange && hour === hourRange.startHour;
                    // Last active hour cell = (endHour - 1), wrapped for the
                    // overnight case. endHour itself is the exclusive
                    // boundary (see isHourInRange), not a cell that's lit up.
                    const isEndOfShift = hourRange && hour === (hourRange.endHour - 1 + 24) % 24;

                    return (
                      <div
                        key={hour}
                        // Each label now fits inside its own cell (no more
                        // bleeding across cells) - that approach looked fine
                        // on same-colored cells but the border of every cell
                        // still drew on top, visibly slicing through the text.
                        className={`border border-zinc-700 h-10 flex items-center justify-center text-[10px] rounded transition-colors
                          ${isHourActive ? 'bg-emerald-600 text-white font-medium' : 'bg-zinc-800 text-zinc-500'}
                        `}
                      >
                        {/* formatHourLabel uses the viewer-converted hourRange,
                            not the shift's raw startTime/endTime - those are in
                            the member's home timezone and would mislabel this
                            cell whenever member tz != viewer tz. */}
                        {isStartOfShift && hourRange && formatHourLabel(hourRange.startHour)}
                        {isEndOfShift && hourRange && !isStartOfShift && formatHourLabel(hourRange.endHour)}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Overlap row - only shown once at least one member is
                  checked in TeamHoursPanel. Same grid template as the member
                  rows above, so columns stay pixel-aligned automatically. */}
              {selectedRows.length > 0 && (
                <div
                  className="grid mx-auto pl-8"
                  style={{ gridTemplateColumns: gridTemplate, gap: gridGap, margin: '10px 0 0', alignItems: 'center', borderTop: '1px solid #3f3f46', paddingTop: '10px' }}
                >
                  <div className="font-bold pr-2 whitespace-nowrap overflow-hidden text-ellipsis text-violet-300 text-sm">
                    Overlap
                  </div>

                  {hours.map(hour => {
                    // Active only if EVERY selected member is active this hour
                    const isOverlapActive = selectedRows.every(row => isHourInRange(row.hourRange, hour));

                    return (
                      <div
                        key={hour}
                        className={`border border-zinc-700 h-10 rounded transition-colors
                          ${isOverlapActive ? 'bg-violet-600' : 'bg-zinc-800/50'}
                        `}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default ScheduleGrid;