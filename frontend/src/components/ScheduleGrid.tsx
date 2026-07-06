import { useEffect } from 'react';
import { useTeam } from '../context/TeamContext';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Ensure plugins are registered for the `.tz` function to work
dayjs.extend(utc);
dayjs.extend(timezone);

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
                // Find all shifts that belong to this specific member
                const memberShifts = shifts.filter(s => {
                  const shiftMemberId = typeof s.teamMemberId === 'string' ? s.teamMemberId : s.teamMemberId?._id;
                  return String(shiftMemberId) === String(member._id);
                });

                // OPTIMIZATION STEP 1: Find the actual valid shift for this row BEFORE the 24-hour loop
                const currentShift = memberShifts.find(s => s.date && s.startTime && s.endTime);

                // OPTIMIZATION STEP 2: Pre-calculate the hour boundaries in the viewer's timezone
                let startHourViewer = -1;
                let endHourViewer = -1;
                let isOvernight = false;

                if (currentShift && member.timezone && viewerTimezone) {
                  // Create dayjs objects localized to the member's home timezone
                  const startInMemberTz = dayjs.tz(`${currentShift.date} ${currentShift.startTime}`, member.timezone);
                  const endInMemberTz = dayjs.tz(`${currentShift.date} ${currentShift.endTime}`, member.timezone);

                  // Shift those times into the viewer's timezone
                  const startInViewerTz = startInMemberTz.tz(viewerTimezone);
                  const endInViewerTz = endInMemberTz.tz(viewerTimezone);

                  // Extract just the hour numbers (0-23) for easy comparison in the map loop
                  startHourViewer = startInViewerTz.hour();
                  endHourViewer = endInViewerTz.hour();

                  // If the end hour is smaller than the start hour, the shift crosses midnight
                  isOvernight = endHourViewer < startHourViewer;
                }

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
                      // Check if the current column's hour falls within the calculated shift range
                      const isHourActive = currentShift && (
                        isOvernight
                          ? (hour >= startHourViewer || hour < endHourViewer)
                          : (hour >= startHourViewer && hour < endHourViewer)
                      );

                      // Only stamp the text labels into the very first hour block of the shift
                      const isStartOfShift = currentShift && hour === startHourViewer;

                      return (
                        <div
                          key={hour}
                          className={`border border-zinc-700 h-10 flex flex-col items-center justify-center text-xs rounded transition-colors
                            ${isHourActive ? 'bg-emerald-600 text-white font-medium' : 'bg-zinc-800 text-zinc-500'}
                          `}
                        >
                          {isStartOfShift && (
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