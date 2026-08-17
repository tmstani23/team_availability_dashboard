import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import ScheduleGrid from './ScheduleGrid';
import { FIXED_NOW, makeMember, makeWeek, renderWithProviders } from '../test/renderWithProviders';

// The OTHER half of the display/write split. MeetingPanel must ignore a
// preview; this must follow one. Testing only the first half would leave
// "preview does nothing at all" passing.

describe('ScheduleGrid', () => {
  // ScheduleGrid calls getCurrentShiftForMember and resolveHourRangeInViewerTz
  // WITHOUT passing `now`, so both fall back to the real clock - and the
  // Chicago/Tokyo gap is 14 hours in summer but 15 in winter. Pinning the
  // system clock is what stops this test flipping its expected labels in
  // November. Only Date is faked; setTimeout and friends stay real so
  // Testing Library's own waiting isn't affected.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW.toDate());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const member = makeMember({ _id: 'm1', timezone: 'America/Chicago' });
  const nineToFive = makeWeek('m1', '09:00', '17:00');

  // The grid draws a start-of-shift and an end-of-shift label INSIDE the
  // member's row, using the hours already converted to the display zone. The
  // header also prints all 24 hour labels, so a label the row is using appears
  // twice on the page and one it isn't appears once. That count is the
  // assertion - it reads the converted value without depending on any markup.
  const labelCount = (label: string) => screen.queryAllByText(label).length;

  it('draws a shift on the viewer\'s own clock when nothing is previewed', () => {
    renderWithProviders(<ScheduleGrid selectedIds={[]} />, {
      team: {
        members: [member],
        recurringShifts: nineToFive,
        now: FIXED_NOW,
        viewerTimezone: 'America/Chicago',
        displayTimezone: 'America/Chicago',
        previewTimezone: null,
      },
    });

    // A Chicago member read from Chicago: 9AM-5PM, unconverted.
    expect(labelCount('9AM')).toBe(2);
    expect(labelCount('5PM')).toBe(2);
    expect(screen.getByText(/All times in Chicago — your local time/)).toBeInTheDocument();
  });

  it('redraws the same shift in the previewed zone', () => {
    renderWithProviders(<ScheduleGrid selectedIds={[]} />, {
      team: {
        members: [member],
        recurringShifts: nineToFive,
        now: FIXED_NOW,
        // viewerTimezone is unchanged - only the DISPLAY zone moves, which is
        // exactly the state MeetingPanel has to ignore and this has to follow.
        viewerTimezone: 'America/Chicago',
        displayTimezone: 'Asia/Tokyo',
        previewTimezone: 'Asia/Tokyo',
      },
    });

    // Chicago 09:00 is Tokyo 23:00, Chicago 17:00 is Tokyo 07:00 - the shift
    // now reads as an overnight one, which is the honest answer.
    expect(labelCount('11PM')).toBe(2);
    expect(labelCount('7AM')).toBe(2);
    // And the Chicago hours are back to appearing only in the column headers.
    expect(labelCount('9AM')).toBe(1);
    expect(labelCount('5PM')).toBe(1);
  });

  it('stops calling the grid "your local time" during a preview', () => {
    renderWithProviders(<ScheduleGrid selectedIds={[]} />, {
      team: {
        members: [member],
        recurringShifts: nineToFive,
        now: FIXED_NOW,
        viewerTimezone: 'America/Chicago',
        displayTimezone: 'Asia/Tokyo',
        previewTimezone: 'Asia/Tokyo',
      },
    });

    // That phrase is what makes the grid's zone trustworthy, so leaving it up
    // during a preview turns the app's most load-bearing label into a lie.
    expect(screen.getByText(/All times in Tokyo — previewing this zone/)).toBeInTheDocument();
    expect(screen.queryByText(/your local time/)).toBeNull();
  });
});
