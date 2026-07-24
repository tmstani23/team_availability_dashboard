import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTeam } from '../context/TeamContext';
import type { DayOfWeek, RecurringShift } from '../types';
import { homePathForRole } from '../utils/routes';
import dayjs from 'dayjs';

interface HoursEditorProps {
  // 'self' reads the target member from AuthContext (own JWT identity);
  // 'admin' reads it from the :id route param. Same PUT /:id/hours contract
  // either way - the backend is what actually enforces who can write what.
  mode: 'self' | 'admin';
}

// Mon-first display order reads more naturally as a "work week" than the
// Sun=0 storage order - the values underneath are still 0-6 (DayOfWeek).
const DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 0];

const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday',
};

interface DayEntry {
  isOff: boolean;
  startTime: string;
  endTime: string;
}

// Default for a weekday with no existing record yet. Prefilling a sane 9-5
// (rather than leaving times blank) means hitting Save on an untouched row
// produces a valid working day instead of a validation error.
const defaultDay = (): DayEntry => ({ isOff: false, startTime: '09:00', endTime: '17:00' });

const emptyWeek = (): Record<DayOfWeek, DayEntry> => ({
  0: defaultDay(), 1: defaultDay(), 2: defaultDay(), 3: defaultDay(),
  4: defaultDay(), 5: defaultDay(), 6: defaultDay(),
});

const HoursEditor = ({ mode }: HoursEditorProps) => {
  const { teamMemberId, role } = useAuth();
  const { id: paramId } = useParams();
  const { members, refreshAllData } = useTeam();

  // Admin mode is always reached from a member's card in /admin/manage, so
  // that's where Back returns. Self mode has to be role-aware: an admin
  // clicking "My Hours" must land back on /admin/schedule, since /dashboard
  // has no tab nav and would strand them (see homePathForRole). Explicit
  // destinations rather than navigate(-1) - history isn't reliable if this
  // page was opened directly (bookmark, refresh, first-run gate link).
  const backTo = mode === 'admin' ? '/admin/manage' : homePathForRole(role);

  const targetId = mode === 'self' ? teamMemberId : paramId;
  const targetMember = members.find(m => m._id === targetId);

  const [week, setWeek] = useState<Record<DayOfWeek, DayEntry>>(emptyWeek());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  // Fetch the target's existing hours whenever the target changes (e.g. an
  // admin navigating from one member's hours page to another's without a
  // full remount). Days with no saved record just keep the emptyWeek default.
  useEffect(() => {
    if (!targetId) return;
    setLoading(true);
    setError('');

    fetch(`http://localhost:5000/api/team-members/${targetId}/hours`, { credentials: 'include' })
      .then(res => {
        // A failed request still parses as JSON, but as a { message } object
        // rather than the array below - without this check the for...of would
        // throw something unrelated instead of showing the real error.
        if (!res.ok) throw new Error('Failed to load hours');
        return res.json();
      })
      .then((hours: RecurringShift[]) => {
        setWeek(prev => {
          const next = { ...prev };
          for (const record of hours) {
            next[record.dayOfWeek] = {
              isOff: record.isOff,
              startTime: record.startTime ?? '09:00',
              endTime: record.endTime ?? '17:00',
            };
          }
          return next;
        });
      })
      .catch(() => setError('Failed to load hours'))
      .finally(() => setLoading(false));
  }, [targetId]);

  const updateDay = (day: DayOfWeek, patch: Partial<DayEntry>) => {
    // Clear the "Hours saved" banner as soon as anything changes, so it can't
    // sit there claiming saved while the form holds unsaved edits.
    setSavedMsg('');
    setWeek(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  };

  const handleSave = async () => {
    setError('');
    setSavedMsg('');

    // Same shift-granularity rule AddTeamMemberForm used to enforce (now
    // removed from there - see nextSteps.md Phase 6). ScheduleGrid renders
    // in whole-hour blocks, so a shift that doesn't land on the hour would
    // silently misrender rather than error anywhere obvious.
    for (const day of DAYS) {
      const entry = week[day];
      if (entry.isOff) continue;

      const start = dayjs(`2026-01-01T${entry.startTime}`);
      const end = dayjs(`2026-01-01T${entry.endTime}`);

      if (!start.isBefore(end)) {
        setError(`${DAY_LABELS[day]}: start time must be before end time`);
        return;
      }
      if (start.minute() !== 0 || end.minute() !== 0) {
        setError(`${DAY_LABELS[day]}: times must be on the hour (e.g. 09:00)`);
        return;
      }
      if (end.diff(start, 'minute') < 60) {
        setError(`${DAY_LABELS[day]}: shift must be at least 1 hour long`);
        return;
      }
    }

    setSaving(true);
    try {
      // Whole-week replace, matching the PUT route's contract - off days
      // send no times at all so the backend's $unset clears any leftovers.
      const payload = {
        week: DAYS.map(day => ({
          dayOfWeek: day,
          isOff: week[day].isOff,
          ...(week[day].isOff ? {} : { startTime: week[day].startTime, endTime: week[day].endTime }),
        })),
      };

      const res = await fetch(`http://localhost:5000/api/team-members/${targetId}/hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to save hours');
      }

      setSavedMsg('Hours saved');

      // TeamContext only fetches on mount, and route changes don't remount
      // TeamProvider - without this the grid and sidebar would keep showing
      // the pre-save hours until a manual page refresh.
      await refreshAllData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save hours');
    } finally {
      setSaving(false);
    }
  };

  // Covers both "auth hasn't resolved teamMemberId yet" (self) and "no :id
  // in the URL" (admin, shouldn't happen given the route, but cheap to guard)
  if (!targetId) return null;
  if (loading) return <div className="p-6 text-zinc-400">Loading hours...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link
        to={backTo}
        className="inline-block mb-4 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        ← Back
      </Link>

      <h2 className="text-2xl font-semibold text-white mb-1">
        {mode === 'self' ? 'My Hours' : `Editing Hours for ${targetMember?.name ?? '...'}`}
      </h2>
      <p className="text-sm text-zinc-400 mb-6">
        Standing weekly hours - these repeat every week until changed.
      </p>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {savedMsg && <p className="text-green-400 text-sm mb-4">{savedMsg}</p>}

      <div className="space-y-3">
        {DAYS.map(day => {
          const entry = week[day];
          return (
            <div
              key={day}
              className="flex items-center gap-4 bg-zinc-800 border border-zinc-700/60 rounded-lg p-3"
            >
              <div className="w-28 text-white font-medium text-sm">{DAY_LABELS[day]}</div>

              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={entry.isOff}
                  onChange={e => updateDay(day, { isOff: e.target.checked })}
                />
                Off
              </label>

              <input
                type="time"
                className="bg-zinc-900 text-white border border-zinc-700 rounded px-2 py-1 text-sm disabled:opacity-40"
                value={entry.startTime}
                disabled={entry.isOff}
                onChange={e => updateDay(day, { startTime: e.target.value })}
              />
              <span className="text-zinc-500">-</span>
              <input
                type="time"
                className="bg-zinc-900 text-white border border-zinc-700 rounded px-2 py-1 text-sm disabled:opacity-40"
                value={entry.endTime}
                disabled={entry.isOff}
                onChange={e => updateDay(day, { endTime: e.target.value })}
              />
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white transition-colors"
      >
        {saving ? 'Saving...' : 'Save Week'}
      </button>
    </div>
  );
};

export default HoursEditor;
