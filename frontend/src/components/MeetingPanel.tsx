import { useState } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useTeam } from '../context/useTeam';
import { useAuth } from '../context/useAuth';
import { resolveMeetingCarveOutInViewerTz } from '../utils/scheduleTime';

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

const inputClass =
  'bg-zinc-800 text-white border border-zinc-700 rounded px-2 py-1.5 text-sm transition-colors focus:outline-none focus:border-violet-500 hover:border-zinc-600';

const MeetingPanel = ({ selectedIds }: MeetingPanelProps) => {
  const { members, meetings, createMeeting, deleteMeeting, viewerTimezone, now } = useTeam();
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
    // This is the ONLY place in the app that crosses from one time model to
    // the other, and it is deliberately one place. The form collects a date
    // and a time, which together name a WALL CLOCK - "2pm on the 3rd" - and
    // that is not yet a moment in time. It becomes one only when pinned to a
    // zone, and the zone that makes it mean what the user intended is the
    // VIEWER's: they typed 2pm meaning 2pm on their own clock.
    //
    // dayjs.tz(...) does exactly that and .toISOString() hands back the
    // instant. From here on the value is an instant everywhere - stored as a
    // UTC Date, converted per-viewer for display - and nothing downstream ever
    // sees these strings again.
    //
    // Getting this wrong is quiet: dayjs(`${date} ${time}`) with no zone uses
    // the BROWSER's zone, which is right only while the viewer's timezone
    // happens to match the browser's. It would work perfectly on your machine
    // and be wrong by an offset for anyone previewing another zone.
    let startsAt: string;
    let endsAt: string;
    try {
      const start = dayjs.tz(`${date} ${time}`, viewerTimezone);
      if (!start.isValid()) return setError('That date and time did not parse');
      startsAt = start.toISOString();
      endsAt = start.add(duration, 'minute').toISOString();
    } catch {
      // dayjs.tz throws on an unknown zone rather than returning invalid.
      return setError('Could not read your timezone');
    }
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
    <div className="bg-zinc-900 border border-zinc-700 rounded-md p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">
          Meetings today{' '}
          <span className="text-xs font-normal text-zinc-500">
            ({viewerTimezone} — your clock)
          </span>
        </h3>
        <button
          onClick={() => (isOpen ? setIsOpen(false) : openForm())}
          className="text-xs px-3 py-1.5 rounded font-medium border bg-violet-500/15 text-violet-300 border-violet-500 hover:bg-violet-500/25 transition-colors"
        >
          {isOpen ? 'Cancel' : 'Book a meeting'}
        </button>
      </div>

      {/* The day's bookings. Empty is a real state worth labelling - a blank
          panel reads as "not loaded" rather than "nothing booked". */}
      {rows.length === 0 ? (
        <p className="text-xs text-zinc-500">Nothing booked for today.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map(({ meeting, carve }) => (
            <li
              key={meeting._id}
              className="flex items-center justify-between gap-3 text-xs bg-zinc-800 border border-zinc-700/60 rounded px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <span className="font-medium text-white">{meeting.title}</span>
                <span className="text-zinc-400">
                  {' '}
                  {carve
                    ? `${formatFractionalHour(carve.startHour)}–${formatFractionalHour(carve.endHour)}`
                    : 'outside today'}
                </span>
                <div className="text-zinc-500 truncate">
                  {meeting.attendeeIds.map(memberName).join(', ')}
                </div>
              </div>
              <button
                onClick={() => handleDelete(meeting._id)}
                className="shrink-0 text-zinc-500 hover:text-red-400 transition-colors"
                aria-label={`Delete ${meeting.title}`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {isOpen && (
        <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-zinc-700 flex flex-col gap-3">
          <input
            className={inputClass}
            placeholder="What's the meeting?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={120}
          />

          <div className="flex flex-wrap gap-2">
            <input type="date" className={inputClass} value={date} onChange={e => setDate(e.target.value)} />
            {/* step=900 keeps the picker on quarter hours, matching the break
                granularity from Phase 2 - the grid can draw a quarter of a
                cell, and finer than that is precision it can't show. */}
            <input type="time" step={900} className={inputClass} value={time} onChange={e => setTime(e.target.value)} />
            <select className={inputClass} value={duration} onChange={e => setDuration(Number(e.target.value))}>
              {DURATIONS.map(minutes => (
                <option key={minutes} value={minutes}>
                  {minutes} min
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs text-zinc-500 mb-1.5">Attendees</div>
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
                        ? 'bg-violet-500/15 text-violet-300 border-violet-500'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
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
              <div className="mt-1.5 text-[11px] text-amber-400/80">
                You can only book meetings you're attending — add yourself.
              </div>
            )}
          </div>

          {error && <div className="text-xs text-red-400">{error}</div>}

          <button
            type="submit"
            disabled={saving}
            className="self-start text-xs px-3 py-1.5 rounded font-medium border bg-violet-500/15 text-violet-300 border-violet-500 hover:bg-violet-500/25 transition-colors disabled:opacity-50"
          >
            {saving ? 'Booking…' : 'Book it'}
          </button>
        </form>
      )}
    </div>
  );
};

export default MeetingPanel;
