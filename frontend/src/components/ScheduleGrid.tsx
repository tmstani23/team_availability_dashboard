import { useEffect, useRef } from 'react';
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
  formatTimezoneLabel,
} from '../utils/scheduleTime';
import ScheduleCell, { COLOR_CARVE, COLOR_MEETING, type CellCarve } from './ScheduleCell';

interface ScheduleGridProps {
  selectedIds: string[];
}

const ScheduleGrid = ({ selectedIds }: ScheduleGridProps) => {
  // 1. Read live synchronizing records directly out of our global application context hook stream
  //
  // displayTimezone, NOT viewerTimezone. This whole component is display, so
  // it follows a timezone preview; the booking form and the meetings fetch
  // window deliberately don't (see the split comment in TeamContext).
  const { members, recurringShifts, meetings, loading, displayTimezone, previewTimezone, now } = useTeam();

  // Hours from 6:00 AM to 5:00 AM next day
  const hours = Array.from({ length: 24 }, (_, i) => (i + 6) % 24);

  // Column maths, shared by the layout below AND the scroll-to-now effect.
  // Hoisted out of the render closure so those two can't drift - the effect
  // used to hardcode 360px, which silently stopped meaning "8AM" the moment
  // any of these changed.
  const NAME_COLUMN_PX = 120;
  const COLUMN_PX = 55;
  const GAP_PX = 2;

  // Scroll to NOW rather than to a constant. The old `scrollLeft = 360` was a
  // magic number tuned to one viewport: on a narrow screen it lands mid-grid
  // with no anchor, which is a good part of why the grid read as "missing" on
  // a phone. Anchoring to the current hour means the first thing on screen is
  // always the part being asked about.
  const gridContainerRef = useRef<HTMLDivElement>(null);
  // Tracks whether the opening scroll has already happened. Needed because the
  // effect can't be a plain mount effect: on the FIRST render `loading` is
  // true and this component returns early, so the ref is still null and there
  // is nothing to scroll. It has to wait for the data, then fire exactly once.
  const hasScrolledToNow = useRef(false);
  useEffect(() => {
    if (loading || hasScrolledToNow.current) return;
    const container = gridContainerRef.current;
    if (!container) return;
    hasScrolledToNow.current = true;

    // Where the current hour sits in the 6AM-first column order.
    const currentHour = now.tz(displayTimezone).hour();
    const index = (currentHour - 6 + 24) % 24;
    const columnLeft = NAME_COLUMN_PX + index * (COLUMN_PX + GAP_PX);

    // Put "now" a little in from the left edge rather than flush against the
    // sticky name column, so the hour before it stays visible for context.
    // Math.max keeps an early-morning hour from scrolling to a negative value.
    container.scrollLeft = Math.max(0, columnLeft - NAME_COLUMN_PX - COLUMN_PX);
    // Depends on `loading` only. It is deliberately NOT keyed to `now` or
    // displayTimezone: this is an OPENING position, not a follow. Re-running
    // it on each poll tick would yank the grid back every ~15s and fight
    // anyone who had scrolled somewhere else, and the ref guard above means
    // it can only ever fire once anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Safety protection barrier while data collections initialize on app startup
  if (loading) return <div className="text-white p-4">Loading schedule data...</div>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold text-white mb-4">Daily Schedule Matrix</h2>
      {/* The grid MUST stay visibly labelled with its zone. Every column here
          is a converted wall clock, and MeetingPanel books against this same
          value - so if a reader can't see which clock they're reading, "2pm"
          in the booking form is ambiguous. "Viewer TZ" was simulation-era
          wording from when this zone was a dropdown; it's the reader's own
          clock now, so it says so. */}
      {/* The caption has to STOP claiming "your local time" while a preview is
          active - that phrase is the one thing making the grid's zone
          trustworthy, so leaving it up during a preview would turn the app's
          most load-bearing label into its most confident lie. */}
      <p className={`text-xs mb-4 ${previewTimezone ? 'text-away' : 'text-ink-muted'}`}>
        All times in {formatTimezoneLabel(displayTimezone) || displayTimezone}
        {previewTimezone ? ' — previewing this zone' : ' — your local time'}
      </p>

      <div ref={gridContainerRef} className="schedule-grid-container overflow-x-auto max-w-full pb-4">
        {(() => {
          const gridGap = `${GAP_PX}px`;
          const gridTemplate = `${NAME_COLUMN_PX}px repeat(${hours.length}, ${COLUMN_PX}px)`;

          // The sticky member-name column. Without this the grid is unreadable
          // the moment it's scrolled at all - you get a wall of coloured cells
          // with no idea whose row you're on, which is worse than not fitting.
          //
          // bg-surface is load-bearing, not decoration: a sticky element is
          // transparent by default, so the cells it overlaps would scroll
          // visibly underneath the names. The right border gives the pinned
          // column an edge so it reads as held in place rather than as
          // overlapping content.
          const stickyNameCell =
            'sticky left-0 z-10 bg-surface border-r border-line pl-4 pr-2';

          // Resolve each member's shift + hourRange ONCE here, instead of
          // recomputing it separately for the member rows and the overlap
          // row below - both now read from this same array.
          const memberRows = members.map(member => {
            // Resolve today's standing shift by the member's OWN weekday, then
            // convert to the viewer's tz. off / unset yield a null range, so
            // those rows render empty.
            const resolution = getCurrentShiftForMember(member._id, recurringShifts, member.timezone);
            const hourRange = resolveHourRangeInViewerTz(resolution, member.timezone, displayTimezone);
            // The standing lunch, converted to the viewer's clock the same way
            // the shift block is. Null when the member has no break set.
            const carveOut = resolveBreakCarveOutInViewerTz(resolution, member.timezone, displayTimezone);

            // Meetings this member is attending, converted from UTC instants
            // to the viewer's clock. Note this uses a DIFFERENT function from
            // the two above and that is the whole point of the phase: shift
            // and break times are wall-clock strings anchored to today, a
            // meeting is an instant that carries its own date. Same CarveOut
            // shape out the other side, so the grid treats them alike from
            // here on.
            //
            // KNOWN EDGE, and the deliberate one: `meetings` was FETCHED for
            // the viewer's local day (the window in TeamContext does not follow
            // a preview, by design), but this clamps to the DISPLAY zone's day.
            // Preview a distant zone and a meeting sitting near the edge of
            // your own day can fall outside the previewed one and stop drawing.
            // Accepted rather than fixed by previewing the fetch too: that
            // would make a display-only control change what the app requests,
            // which is the exact coupling the display/write split exists to
            // prevent. The banner names the preview, so an incomplete edge hour
            // reads as a preview artefact rather than as missing data.
            const meetingCarveOuts = meetingsForMember(meetings, member._id)
              .map(m => resolveMeetingCarveOutInViewerTz(m, displayTimezone, now))
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
            // width: max-content, NOT a minWidth plus auto margins. `mx-auto`
            // on content wider than its scroll container is a known trap: the
            // negative margin it computes makes part of the overflow
            // UNREACHABLE rather than scrollable, which is why the grid was
            // effectively invisible at narrow widths. Nothing centres itself
            // in here now - the content is simply as wide as it is and the
            // container scrolls it.
            //
            // No left padding either, so the sticky name column can sit flush
            // against the scrollport edge instead of a 32px gap sliding under it.
            <div style={{ width: 'max-content' }} className="py-4 pr-4">
              {/* Scrollable header */}
              <div
                className="grid"
                style={{ gridTemplateColumns: gridTemplate, gap: gridGap, marginBottom: '12px', paddingBottom: '8px' }}
              >
                {/* Empty, but still sticky and still opaque - it's the corner
                    above the pinned name column, and a transparent one lets
                    hour labels slide visibly under the names. */}
                <div className={`${stickyNameCell} self-stretch`}></div>
                {hours.map(hour => (
                  <div key={hour} className="text-center font-bold text-xs whitespace-nowrap text-white tnum">
                    {formatHourLabel(hour)}
                  </div>
                ))}
              </div>

              {/* Team Member Rows - centered with padding */}
              {memberRows.map(({ member, hourRange, resolution, carveOut, meetingCarveOuts }) => (
                <div
                  key={member._id}
                  className="grid"
                  style={{ gridTemplateColumns: gridTemplate, gap: gridGap, margin: '6px 0', alignItems: 'center' }}
                >
                  {/* self-stretch matters here. The row sets alignItems:center,
                      so without it this cell is only as tall as its text and
                      its background stops short of the row - which means cells
                      scrolling underneath peek out above and below the name. */}
                  <div className={`${stickyNameCell} overflow-hidden self-stretch flex flex-col justify-center`}>
                    <div className="font-bold whitespace-nowrap overflow-hidden text-ellipsis text-white">
                      {member.name}
                    </div>
                    {/* An empty row of cells is ambiguous on its own: it means
                        "off today" and "hours never set up" equally. Label the
                        two so a brand-new member isn't silently read as
                        someone who just isn't working today. Amber matches the
                        sidebar's unset treatment. */}
                    {resolution.state === 'off' && (
                      <div className="text-[10px] text-ink-faint whitespace-nowrap">Off today</div>
                    )}
                    {resolution.state === 'unset' && (
                      <div className="text-[10px] text-away/80 whitespace-nowrap">Hours not set</div>
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
                  className="grid"
                  style={{ gridTemplateColumns: gridTemplate, gap: gridGap, margin: '10px 0 0', alignItems: 'center', borderTop: '1px solid var(--color-line)', paddingTop: '10px' }}
                >
                  {/* Sky, matching the row's own fill and the "In a meeting"
                      pill - this label, the cells beside it and the status
                      pill are all the same feature, so they're one colour.
                      Violet is reserved for things you can click. */}
                  {/* Sticky too - a pinned column that loses its label on the
                      one row that isn't a person would read as a gap. The
                      inline paddingTop above lands on this cell as well, so the
                      background covers the full row height it occupies. */}
                  <div className={`${stickyNameCell} font-bold whitespace-nowrap overflow-hidden text-ellipsis text-booked text-sm self-stretch flex items-center`}>
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