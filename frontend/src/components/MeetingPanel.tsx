import { useState } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useTeam } from '../context/useTeam';
import { useAuth } from '../context/useAuth';
import { resolveMeetingCarveOutInViewerTz, wallClockToInstant } from '../utils/scheduleTime';
import { dayOptions } from '../utils/timeOptions';
import TimeSelect from './TimeSelect';
import ThemedSelect from './ThemedSelect';

dayjs.extend(utc);
dayjs.extend(timezone);

// Booking + listing for the viewer's current day. Lives directly under the
// Overlap Finder because that's where this feature's whole point is: the
// finder used to tell you when everyone was free and then hand you off to an
// external calendar. Now the answer and the action are in the same place, and
// the attendee list starts as whoever you had checked in the finder.

interface MeetingPanelProps {
  // Members checked in TeamHoursPanel. Used only to PREFILL the attendee list,
  // not to drive it - once the form is open, its own selection takes over, so
  // unchecking someone in the finder mid-edit doesn't silently rewrite what
  // you're about to book.
  selectedIds: string[];
}

// Duration choices in minutes. Fixed options rather than a free end-time field:
// two time inputs invite "ends before it starts", and every meeting worth
// booking here is one of these.
const DURATIONS = [15, 30, 45, 60, 90, 120];
import { inputClasses } from '../utils/ui';
import Button from './Button';

const inputClass = inputClasses('sm');

const MeetingPanel = ({ selectedIds }: MeetingPanelProps) => {
  // viewerTimezone UNCONDITIONALLY - this component both reads and WRITES
  // times, and a timezone preview must never be able to reinterpret a write
  // (see the split comment in TeamContext). previewTimezone is pulled in only
  // to say so on screen while one is active; it never reaches the conversion.
  const { members, meetings, createMeeting, deleteMeeting, viewerTimezone, previewTimezone, now } = useTeam();
  const { teamMemberId } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => now.tz(viewerTimezone).format('YYYY-MM-DD'));
  const [time, setTime] = useState('14:00');
  const [duration, setDuration] = useState(30);
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const memberName = (id: string) => members.find(m => m._id === id)?.name ?? 'Unknown';

  // Both option lists are built from viewerTimezone, NOT displayTimezone -
  // same rule as the conversion in handleSubmit. The day list especially:
  // "Today" has to mean the viewer's today, or previewing Tokyo would offer a
  // date that books into what is, on their own clock, yesterday.
  const days = dayOptions(viewerTimezone, now);

  const openForm = () => {
    // Prefill from the Overlap Finder, plus yourself - the server requires the
    // creator to be an attendee, so adding you here means the common path
    // never hits that 403 at all.
    const prefill = [...selectedIds];
    if (teamMemberId && !prefill.includes(teamMemberId)) prefill.push(teamMemberId);
    setAttendeeIds(prefill);
    setDate(now.tz(viewerTimezone).format('YYYY-MM-DD'));
    setError(null);
    setIsOpen(true);
  };

  const toggleAttendee = (id: string) => {
    setAttendeeIds(prev =>
      prev.includes(id) ? prev.filter(existing => existing !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError('Give the meeting a title');
    if (attendeeIds.length === 0) return setError('Pick at least one attendee');

    // ================== WALL CLOCK BECOMES AN INSTANT HERE ==================
    // The conversion itself lives in scheduleTime.ts (see wallClockToInstant)
    // alongside every other timezone function, and is tested there. What stays
    // here is the choice of ZONE, which is the part that's a decision rather
    // than arithmetic:
    //
    // viewerTimezone, NEVER displayTimezone. The user typed 2pm meaning 2pm on
    // their own clock, and a preview must not be able to reinterpret that -
    // otherwise previewing Tokyo and booking "2pm" lands the meeting at 2pm
    // Tokyo. That's the display/write split, and this line is the write side
    // of it.
    const converted = wallClockToInstant(date, time, viewerTimezone, duration);
    if (!converted.ok) {
      return setError(
        converted.reason === 'timezone'
          ? 'Could not read your timezone'
          : 'That date and time did not parse'
      );
    }
    const { startsAt, endsAt } = converted;
    // =======================================================================

    setSaving(true);
    const result = await createMeeting({ title: title.trim(), startsAt, endsAt, attendeeIds });
    setSaving(false);

    if (!result.success) return setError(result.message ?? 'Could not create the meeting');

    setTitle('');
    setIsOpen(false);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteMeeting(id);
    // A refusal (403 - organizer or admin only) needs saying out loud. Without
    // this the row would reappear on the next poll with no explanation.
    if (!result.success && result.message) setError(result.message);
  };

  // Meetings come back sorted by startsAt from the API. Each one's label is
  // built from the same carve-out conversion the grid uses, so the list and
  // the coloured block on the row can't disagree about when it is.
  const rows = meetings.map(meeting => {
    const carve = resolveMeetingCarveOutInViewerTz(meeting, viewerTimezone, now);
    return { meeting, carve };
  });

  // Renders a fractional hour (14.5) as "2:30 PM" on the viewer's clock.
  const formatFractionalHour = (value: number) => {
    const hour = Math.floor(value) % 24;
    const minute = Math.round((value - Math.floor(value)) * 60);
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
  };

  return (
    <div className="bg-card border border-line rounded-xl p-4 mb-4">
      {/* flex-wrap + gap, so the "Book a meeting" button drops to its own line
          instead of colliding with the header's zone caption on a narrow
          screen. items-start rather than center keeps the two aligned once
          they do wrap. */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-white min-w-0">
          Meetings today{' '}
          {/* While a preview is running, the grid above and this panel are on
              two different clocks - which is correct, and is exactly the thing
              a reader would never guess. So the label stops being a quiet
              caption and says which zone wins here. */}
          <span className={`text-xs font-normal ${previewTimezone ? 'text-away' : 'text-ink-faint'}`}>
            ({viewerTimezone} — {previewTimezone ? 'your clock, not the preview' : 'your clock'})
          </span>
        </h3>
        <Button
          onClick={() => (isOpen ? setIsOpen(false) : openForm())}
          variant="outline" size="sm"
        >
          {isOpen ? 'Cancel' : 'Book a meeting'}
        </Button>
      </div>

      {/* The day's bookings. Empty is a real state worth labelling - a blank
          panel reads as "not loaded" rather than "nothing booked". */}
      {rows.length === 0 ? (
        <p className="text-xs text-ink-faint">Nothing booked for today.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map(({ meeting, carve }) => (
            <li
              key={meeting._id}
              className="flex items-center justify-between gap-3 text-xs bg-inset border border-line rounded-md px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <span className="font-medium text-white">{meeting.title}</span>
                <span className="text-ink-muted">
                  {' '}
                  {carve
                    ? `${formatFractionalHour(carve.startHour)}–${formatFractionalHour(carve.endHour)}`
                    : 'outside today'}
                </span>
                <div className="text-ink-faint truncate">
                  {meeting.attendeeIds.map(memberName).join(', ')}
                </div>
              </div>
              <button
                onClick={() => handleDelete(meeting._id)}
                className="shrink-0 text-ink-faint hover:text-dnd transition-colors"
                aria-label={`Delete ${meeting.title}`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {isOpen && (
        <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-line flex flex-col gap-3">
          <input
            className={inputClass}
            placeholder="What's the meeting?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={120}
          />

          {/* All three are <select>, so all three theme with inputClasses.
              The date and time used to be native date/time inputs, whose
              dropdown panels live in Chrome's closed shadow DOM and can't be
              styled at all - see the header note in utils/timeOptions.ts for
              why a select is the safe replacement and a text input isn't.

              The values these produce are identical to what the native inputs
              produced ("YYYY-MM-DD" and "HH:mm"), so handleSubmit below is
              untouched - it still receives exactly the strings it did before. */}
          <div className="flex flex-wrap gap-2">
            <ThemedSelect
              value={date}
              onChange={setDate}
              label="Date"
              className="w-[9.5rem]"
            >
              {days.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </ThemedSelect>
            {/* Quarter hours, which is what step={900} on the old input already
                enforced - the grid can draw a quarter of a cell, and finer than
                that is precision it can't show. So this restricts nothing that
                wasn't already restricted. */}
            <TimeSelect value={time} onChange={setTime} label="Start time" />
            <ThemedSelect
              value={String(duration)}
              onChange={value => setDuration(Number(value))}
              label="Duration"
              className="w-[6.5rem]"
            >
              {DURATIONS.map(minutes => (
                <option key={minutes} value={minutes}>
                  {minutes} min
                </option>
              ))}
            </ThemedSelect>
          </div>

          <div>
            <div className="text-xs text-ink-faint mb-1.5">Attendees</div>
            <div className="flex flex-wrap gap-1.5">
              {members.map(member => {
                const checked = attendeeIds.includes(member._id);
                const isSelf = member._id === teamMemberId;
                return (
                  <button
                    type="button"
                    key={member._id}
                    onClick={() => toggleAttendee(member._id)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                      checked
                        ? 'bg-brand/15 text-brand-hover border-brand'
                        : 'bg-inset text-ink-muted border-line hover:border-line-strong'
                    }`}
                  >
                    {member.name}
                    {isSelf && ' (You)'}
                  </button>
                );
              })}
            </div>
            {/* Says the rule before the server has to. The backend is still the
                authority - this is a hint, not the check. */}
            {teamMemberId && !attendeeIds.includes(teamMemberId) && (
              <div className="mt-1.5 text-[11px] text-away/80">
                You can only book meetings you're attending — add yourself.
              </div>
            )}
          </div>

          {error && <div className="text-xs text-dnd">{error}</div>}

          <Button
            type="submit"
            disabled={saving}
            variant="outline" size="sm" className="self-start"
          >
            {saving ? 'Booking…' : 'Book it'}
          </Button>
        </form>
      )}
    </div>
  );
};

export default MeetingPanel;
