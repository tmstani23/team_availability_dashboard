import { useEffect } from 'react';
import { useTeam } from '../context/TeamContext';

const ScheduleGrid = () => {
  // 1. Read live synchronizing records directly out of our global application context hook stream
  const { members, shifts, loading } = useTeam();

  // Hours from 0:00 to 23:00 for full 24hr support
  const hours = Array.from({ length: 24 }, (_, i) => i);

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

      {/* Wrap everything in ONE single scroll container so header and rows scroll together */}
      <div className="schedule-grid-container overflow-x-auto max-w-full pb-4">
        {/* Define structural variables to keep both grids perfectly identical. */}
        {(() => {
          const totalColumns = hours.length + 1;
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
                  <div key={hour} className="text-center font-bold text-xs whitespace-nowrap">
                    {hour}:00
                  </div>
                ))}
              </div>

              {/* Team Member Rows - centered with padding */}
              {members.map(member => {
                const memberShifts = shifts.filter(s => {
                  const shiftMemberId = typeof s.teamMemberId === 'string' ? s.teamMemberId : s.teamMemberId?._id;
                  return String(shiftMemberId) === String(member._id);
                });
                return (
                  <div 
                    key={member._id} 
                    className="grid mx-auto pl-8" 
                    style={{ gridTemplateColumns: gridTemplate, gap: gridGap, margin: '6px 0', alignItems: 'center' }}
                  >
                    {/* Name Column */}
                    <div className="font-bold pr-2 whitespace-nowrap overflow-hidden text-ellipsis">
                      {member.name}
                    </div>
                    {hours.map(hour => {
                      const shift = memberShifts.find(s => {
                        const startHour = parseInt(s.startTime.split(':')[0]);
                        const endHour = parseInt(s.endTime.split(':')[0]);
                        return hour >= startHour && hour < endHour;
                      });
                      const isStartOfShift = shift && hour === parseInt(shift.startTime.split(':')[0]);
                      return (
                        <div
                          key={hour}
                          className={`border border-zinc-700 h-10 flex flex-col items-center justify-center text-xs rounded ${shift ? 'bg-emerald-600 text-white' : 'bg-zinc-800'}`}
                        >
                          {isStartOfShift && (
                            <>
                              <div>{shift.startTime}</div>
                              <div className="text-[10px] opacity-75">to</div>
                              <div>{shift.endTime}</div>
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