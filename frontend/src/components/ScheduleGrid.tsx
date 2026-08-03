import { useEffect } from 'react';
import { useTeam } from '../context/useTeam';
import {
  resolveHourRangeInViewerTz,
  resolveBreakCarveOutInViewerTz,
  resolveMeetingCarveOutInViewerTz,
  meetingsForMember,
  carveOutFractionInHour,
  getCurrentShiftForMember,
  isHourInRange,
  formatHourLabel,
} from '../utils/scheduleTime';
import ScheduleCell, { COLOR_CARVE, COLOR_MEETING, type CellCarve } from './ScheduleCell';

interface ScheduleGridProps {
  selectedIds: string[];
}

const ScheduleGrid = ({ selectedIds }: ScheduleGridProps) => {
  // 1. Read live synchronizing records directly out of our global application context hook stream
  const { members, recurringShifts, meetings, loading, viewerTimezone, now } = useTeam();

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
          const memberRows = members.map(member => {
            // Resolve today's standing shift by the member's OWN weekday, then
            // convert to the viewer's tz. off / unset yield a null range, so
            // those rows render empty.
            const resolution = getCurrentShiftForMember(member._id, recurringShifts, member.timezone);
            const hourRange = resolveHourRangeInViewerTz(resolution, member.timezone, viewerTimezone);
            // The standing lunch, converted to the viewer's clock the same way
            // the shift block is. Null when the member has no break set.
            const carveOut = resolveBreakCarveOutInViewerTz(resolution, member.timezone, viewerTimezone);

            // Meetings this member is attending, converted from UTC instants
            // to the viewer's clock. Note this uses a DIFFERENT function from
            // the two above and that is the whole point of the phase: shift
            // and break times are wall-clock strings anchored to today, a
            // meeting is an instant that carries its own date. Same CarveOut
            // shape out the other side, so the grid treats them alike from
            // here on.
            const meetingCarveOuts = meetingsForMember(meetings, member._id)
              .map(m => resolveMeetingCarveOutInViewerTz(m, viewerTimezone, now))
              .filter(carve => carve !== null);

            // resolution is carried through (not just hourRange) because off
            // and unset BOTH produce a null range and therefore an identical
            // empty row - only resolution.state can tell them apart, and the
            // name column labels the difference below.
            return { member, hourRange, resolution, carveOut, meetingCarveOuts };
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
              {memberRows.map(({ member, hourRange, resolution, carveOut, meetingCarveOuts }) => (
                <div
                  key={member._id}
                  className="grid mx-auto pl-8"
                  style={{ gridTemplateColumns: gridTemplate, gap: gridGap, margin: '6px 0', alignItems: 'center' }}
                >
                  <div className="pr-2 overflow-hidden">
                    <div className="font-bold whitespace-nowrap overflow-hidden text-ellipsis text-white">
                      {member.name}
                    </div>
                    {/* An empty row of cells is ambiguous on its own: it means
                        "off today" and "hours never set up" equally. Label the
                        two so a brand-new member isn't silently read as
                        someone who just isn't working today. Amber matches the
                        sidebar's unset treatment. */}
                    {resolution.state === 'off' && (
                      <div className="text-[10px] text-zinc-500 whitespace-nowrap">Off today</div>
                    )}
                    {resolution.state === 'unset' && (
                      <div className="text-[10px] text-amber-400/80 whitespace-nowrap">Hours not set</div>
                    )}
                  </div>

                  {hours.map(hour => {
                    const isHourActive = isHourInRange(hourRange, hour);
                    const isStartOfShift = hourRange && hour === hourRange.startHour;
                    // Last active hour cell = (endHour - 1), wrapped for the
                    // overnight case. endHour itself is the exclusive
                    // boundary (see isHourInRange), not a cell that's lit up.
                    const isEndOfShift = hourRange && hour === (hourRange.endHour - 1 + 24) % 24;

                    // Every carve-out touching this cell, in one list: the
                    // standing lunch (if it reaches this hour) plus any booked
                    // meetings. Both arrive as CarveOuts by now, so the only
                    // thing that distinguishes them here is the colour - which
                    // is the payoff for keeping CarveOut free of any notion of
                    // what it represents.
                    //
                    // LUNCH FIRST, MEETINGS AFTER, and that order is load-
                    // bearing: ScheduleCell draws later slices on top, so this
                    // is where "a meeting outranks a lunch" gets expressed
                    // visually - matching the status precedence in status.ts.
                    // A meeting booked inside a full-hour lunch has to stay
                    // visible, not get painted over by it.
                    const lunchSlice = carveOutFractionInHour(carveOut, hour);
                    const cellCarves: CellCarve[] = [
                      ...(lunchSlice ? [{ ...lunchSlice, color: COLOR_CARVE }] : []),
                      ...meetingCarveOuts
                        .map(carve => carveOutFractionInHour(carve, hour))
                        .filter(slice => slice !== null)
                        .map(slice => ({ ...slice, color: COLOR_MEETING })),
                    ];

                    return (
                      // Each label fits inside its own cell (no more bleeding
                      // across cells) - that approach looked fine on
                      // same-colored cells but the border of every cell still
                      // drew on top, visibly slicing through the text.
                      <ScheduleCell
                        key={hour}
                        isActive={isHourActive}
                        carves={cellCarves}
                      >
                        {/* formatHourLabel uses the viewer-converted hourRange,
                            not the shift's raw startTime/endTime - those are in
                            the member's home timezone and would mislabel this
                            cell whenever member tz != viewer tz. */}
                        {isStartOfShift && hourRange && formatHourLabel(hourRange.startHour)}
                        {isEndOfShift && hourRange && !isStartOfShift && formatHourLabel(hourRange.endHour)}
                      </ScheduleCell>
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
                    // Active only if EVERY selected member is on shift this
                    // hour AND none of them has a lunch OR a booked meeting
                    // touching it.
                    //
                    // The carve-out test is deliberately STRICT - any carve-out
                    // at all kills the whole hour, even a 15-minute one. This
                    // row answers "can we all meet then," and a half-lit cell
                    // would imply bookable time the row isn't actually
                    // asserting. Losing 45 usable minutes is a cheaper error
                    // than suggesting a slot that lands on someone's lunch,
                    // which is the exact problem this feature exists to fix.
                    //
                    // Meetings joined that test in Phase 3 for the same reason,
                    // only sharper: without it the row would say "everyone is
                    // free at 2pm" about a 2pm that's already booked - and now
                    // that this row is also where you BOOK the meeting, it
                    // would be lying about a slot it just filled.
                    const isOverlapActive =
                      selectedRows.every(row => isHourInRange(row.hourRange, hour)) &&
                      !selectedRows.some(row =>
                        carveOutFractionInHour(row.carveOut, hour) ||
                        row.meetingCarveOuts.some(carve => carveOutFractionInHour(carve, hour))
                      );

                    return (
                      <ScheduleCell key={hour} isActive={isOverlapActive} variant="overlap" />
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