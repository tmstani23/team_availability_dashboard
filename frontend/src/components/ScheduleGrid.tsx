import { useEffect } from 'react';
import { useTeam } from '../context/TeamContext';
import { resolveHourRangeInViewerTz, getCurrentShiftForMember } from '../utils/scheduleTime';

const ScheduleGrid = () => {
  // 1. Read live synchronizing records directly out of our global application context hook stream
  const { members, shifts, loading, viewerTimezone } = useTeam();

  // Hours from 6:00 AM to 5:00 AM next day
  const hours = Array.from({ length: 24 }, (_, i) => (i + 6) % 24);

  // Safety protection barrier while data collections initialize on app startup
  if (loading) return <div className="text-white p-4">Loading schedule data...</div>;

  // Auto-scroll to typical work hours (around 8AM) on load
  useEffect(() => {
    const gridContainer = document.querySelector('.schedule-grid-container');
    if (gridContainer) {
      gridContainer.scrollLeft = 360; // Approximate scroll to 8AM column
    }
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-white mb-4">Daily Schedule Matrix</h2>
      <p className="text-xs text-zinc-400">Viewer TZ: {viewerTimezone}</p>

      {/* Wrap everything in ONE single scroll container so header and rows scroll together */}
      <div className="schedule-grid-container overflow-x-auto max-w-full pb-4">
        {/* Define structural variables to keep both grids perfectly identical. */}
        {(() => {
          const columnWidth = '55px'; // Adjusted for better fit
          const gridGap = '2px';
          const gridTemplate = `120px repeat(${hours.length}, ${columnWidth})`;

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
                {/* Empty placeholder column matching the 120px name column */}
                <div></div>
                {hours.map(hour => (
                  <div key={hour} className="text-center font-bold text-xs whitespace-nowrap text-white">
                    {hour}:00
                  </div>
                ))}
              </div>

              {/* Team Member Rows - centered with padding */}
              {members.map(member => {


                // OPTIMIZATION STEP 1: Find the actual valid shift for this row BEFORE the 24-hour loop
                const currentShift = getCurrentShiftForMember(member._id, shifts);

                // OPTIMIZATION STEP 2: Resolve the shift's hour boundaries into the viewer's timezone.
                // All the dayjs conversion logic that used to live inline here now lives in one
                // shared, testable function — hourRange is null when there's nothing to show
                // (no shift, missing timezone, etc), so we don't need a -1 sentinel anymore.
                const hourRange = resolveHourRangeInViewerTz(currentShift, member.timezone, viewerTimezone);

                return (
                  <div
                    key={member._id}
                    className="grid mx-auto pl-8"
                    style={{ gridTemplateColumns: gridTemplate, gap: gridGap, margin: '6px 0', alignItems: 'center' }}
                  >
                    {/* Name Column */}
                    <div className="font-bold pr-2 whitespace-nowrap overflow-hidden text-ellipsis text-white">
                      {member.name}
                    </div>

                    {/* Map out the 24 hour blocks */}
                    {hours.map(hour => {
                      // Check if the current column's hour falls within the calculated shift range.
                      // hourRange being null (no valid shift) makes isHourActive false automatically.
                      const isHourActive = hourRange && (
                        hourRange.isOvernight
                          ? (hour >= hourRange.startHour || hour < hourRange.endHour)
                          : (hour >= hourRange.startHour && hour < hourRange.endHour)
                      );

                      // Only stamp the text labels into the very first hour block of the shift
                      const isStartOfShift = hourRange && hour === hourRange.startHour;

                      return (
                        <div
                          key={hour}
                          className={`border border-zinc-700 h-10 flex flex-col items-center justify-center text-xs rounded transition-colors
                            ${isHourActive ? 'bg-emerald-600 text-white font-medium' : 'bg-zinc-800 text-zinc-500'}
                          `}
                        >
                          {isStartOfShift && currentShift && (
                            <>
                              <div>{currentShift.startTime}</div>
                              <div className="text-[10px] opacity-75">to</div>
                              <div>{currentShift.endTime}</div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default ScheduleGrid;