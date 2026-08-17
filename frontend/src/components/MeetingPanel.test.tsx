import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MeetingPanel from './MeetingPanel';
import { FIXED_NOW, makeMember, renderWithProviders } from '../test/renderWithProviders';

// THE TEST THIS WHOLE SETUP EXISTS FOR.
//
// TeamContext splits the timezone in two: displayTimezone follows a preview,
// viewerTimezone never does. Booking has to read viewerTimezone, or previewing
// Tokyo and typing "2 PM" books 2 PM in Tokyo rather than on the clock the user
// was reading.
//
// wallClockToInstant is already tested to death in scheduleTime.test.ts, so the
// arithmetic isn't in question. What no unit test can reach is WHICH ZONE this
// component hands it - that's a call site, not a function, and swapping the two
// identifiers leaves every one of the existing tests green. This is the only
// thing that catches it.

describe('MeetingPanel', () => {
  const self = makeMember({ _id: 'self', name: 'Ada Lovelace' });

  // Chicago viewer, Tokyo preview. The two zones are 14 hours apart on this
  // date, so a wrong zone can't accidentally produce the right instant.
  const previewingTokyoFromChicago = {
    members: [self],
    now: FIXED_NOW, // 2026-06-15T18:00Z = 1:00 PM in Chicago
    viewerTimezone: 'America/Chicago',
    previewTimezone: 'Asia/Tokyo',
    displayTimezone: 'Asia/Tokyo',
  };

  it('books on the viewer\'s clock while a preview is active', async () => {
    const user = userEvent.setup();
    const createMeeting = vi.fn(async () => ({ success: true }));

    renderWithProviders(<MeetingPanel selectedIds={[]} />, {
      team: { ...previewingTokyoFromChicago, createMeeting },
      auth: { teamMemberId: 'self' },
    });

    await user.click(screen.getByRole('button', { name: 'Book a meeting' }));

    // The title field is the form's only text box. Everything else is a select
    // or a toggle, all of them queried by their accessible name rather than by
    // position - component tests are the ones that rot, and markup moves.
    await user.type(screen.getByRole('textbox'), 'Standup');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Date' }), '2026-06-15');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Start time hour' }), '14');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Start time minute' }), '00');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Duration' }), '60');

    await user.click(screen.getByRole('button', { name: 'Book it' }));

    // 2:00 PM in Chicago on 2026-06-15 (CDT, UTC-5) is 19:00Z. The same wall
    // clock read as Tokyo would be 05:00Z - fourteen hours off, and drawn on
    // the wrong day for half the team.
    expect(createMeeting).toHaveBeenCalledWith({
      title: 'Standup',
      startsAt: '2026-06-15T19:00:00.000Z',
      endsAt: '2026-06-15T20:00:00.000Z',
      // openForm prefills the Overlap Finder's selection plus yourself, since
      // the server requires the creator to be an attendee.
      attendeeIds: ['self'],
    });
  });

  it('offers dates on the viewer\'s clock, not the previewed one', async () => {
    const user = userEvent.setup();

    renderWithProviders(<MeetingPanel selectedIds={[]} />, {
      team: previewingTokyoFromChicago,
      auth: { teamMemberId: 'self' },
    });

    await user.click(screen.getByRole('button', { name: 'Book a meeting' }));

    // 1:00 PM Chicago is already 3:00 AM the NEXT day in Tokyo, so "Today"
    // means a different date in each zone. It has to mean the viewer's, or the
    // form defaults to booking into what is, on their own clock, yesterday.
    expect(screen.getByRole('combobox', { name: 'Date' })).toHaveValue('2026-06-15');
  });

  it('says which clock it is on while a preview is running', () => {
    renderWithProviders(<MeetingPanel selectedIds={[]} />, {
      team: previewingTokyoFromChicago,
      auth: { teamMemberId: 'self' },
    });

    // The grid above is showing Tokyo and this panel is showing Chicago. That
    // is correct and completely unguessable, so the panel has to say so.
    expect(
      screen.getByText(/America\/Chicago — your clock, not the preview/)
    ).toBeInTheDocument();
  });
});
