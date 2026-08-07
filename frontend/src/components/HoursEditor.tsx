import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useTeam } from '../context/useTeam';
import type { DayOfWeek, RecurringShift } from '../types';
import { homePathForRole } from '../utils/routes';
import { API_BASE } from '../config';
import Button from './Button';
import { inputClasses } from '../utils/ui';
import dayjs, { type Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

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
  // Whether this day has a standing lunch. Kept as its own flag rather than
  // inferring it from empty time strings: the two break inputs always hold a
  // value (same prefill reasoning as the shift times below), so "" can't be
  // the signal for "no break" the way it could with blank inputs.
  hasBreak: boolean;
  breakStart: string;
  breakEnd: string;
}

// Default for a weekday with no existing record yet. Prefilling a sane 9-5
// (rather than leaving times blank) means hitting Save on an untouched row
// produces a valid working day instead of a validation error. Same idea for
// the break: a prefilled 12:00-12:30 means ticking the box is enough, with no
// second step before the row is valid.
const defaultDay = (): DayEntry => ({
  isOff: false,
  startTime: '09:00',
  endTime: '17:00',
  hasBreak: false,
  breakStart: '12:00',
  breakEnd: '12:30',
});

const MINUTES_PER_DAY = 24 * 60;

// "HH:mm" -> minutes since midnight, or null if it isn't that shape. Null
// rather than NaN because every comparison against NaN is silently false,
// which would let a malformed time pass validation unnoticed.
const toMinutes = (time: string): number | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

// Minutes from `start` forward to `end`, wrapping past midnight if needed.
// This is the whole trick behind overnight support: 20:00 -> 05:00 is 540
// minutes, not the -900 a plain subtraction gives. Equal times give 0, not a
// full day - an all-day shift from a typo would be worse than an error.
const forwardDuration = (start: number, end: number): number =>
  (end - start + MINUTES_PER_DAY) % MINUTES_PER_DAY;

// Reads `moment` on another zone's clock, or null if the zone string is junk.
// dayjs throws on an unknown timezone, and a bad value stored on one member
// shouldn't take down the whole editor.
const inZone = (moment: Dayjs, tz: string | undefined): Dayjs | null => {
  if (!tz) return null;
  try {
    return moment.tz(tz);
  } catch {
    return null;
  }
};

// "+15h" / "-5h30m". Computed live from two moments, never stored: the gap
// between two zones changes twice a year AND the two ends rarely switch on the
// same date, so Sydney-to-Chicago is 15, 16 or 17 hours depending on the week.
const formatOffset = (target: Dayjs, viewer: Dayjs): string => {
  const diff = target.utcOffset() - viewer.utcOffset();
  const sign = diff < 0 ? '-' : '+';
  const hours = Math.floor(Math.abs(diff) / 60);
  const minutes = Math.abs(diff) % 60;
  return `${sign}${hours}h${minutes ? `${minutes}m` : ''}`;
};

const emptyWeek = (): Record<DayOfWeek, DayEntry> => ({
  0: defaultDay(), 1: defaultDay(), 2: defaultDay(), 3: defaultDay(),
  4: defaultDay(), 5: defaultDay(), 6: defaultDay(),
});

const HoursEditor = ({ mode }: HoursEditorProps) => {
  const { teamMemberId, role } = useAuth();
  const { id: paramId } = useParams();
  // `now` ticks with the poll (see useRefreshTick), so the clocks below stay
  // live instead of freezing at mount - which matters most in exactly the
  // situation this display exists for: sitting on this page near a date
  // boundary in someone else's timezone.
  const { members, refreshAllData, now } = useTeam();

  // Admin mode is always reached from a member's card in /admin/manage, so
  // that's where Back returns. Self mode has to be role-aware: an admin
  // clicking "My Hours" must land back on /admin/schedule, since /dashboard
  // has no tab nav and would strand them (see homePathForRole). Explicit
  // destinations rather than navigate(-1) - history isn't reliable if this
  // page was opened directly (bookmark, refresh, first-run gate link).
  const backTo = mode === 'admin' ? '/admin/manage' : homePathForRole(role);

  const targetId = mode === 'self' ? teamMemberId : paramId;
  const targetMember = members.find(m => m._id === targetId);

  // The clocks. `viewerNow` is the browser's own time - deliberately NOT
  // TeamContext.viewerTimezone, which is the legacy "simulate as user"
  // dropdown (tech debt, see nextSteps.md). "Your time" here has to mean the
  // person actually typing, not whoever is being previewed.
  const viewerNow = now;
  const targetNow = inZone(now, targetMember?.timezone);

  // Which weekday it currently is FOR THE TARGET, used to mark their row.
  // This is the whole point: every other consumer of this data (sidebar,
  // grid) resolves by the member's own weekday, and the editor was the one
  // place that didn't - so an admin in Chicago would edit "Friday" meaning
  // "today" while their Sydney colleague was already into Saturday, and the
  // change landed on the wrong row with nothing on screen to contradict it.
  const targetToday = targetNow ? (targetNow.day() as DayOfWeek) : null;

  // Only worth calling out the difference when the two clocks disagree about
  // the date - on the same day it's noise, and in self mode it's always you.
  const crossesDateBoundary =
    targetNow !== null && targetNow.format('YYYY-MM-DD') !== viewerNow.format('YYYY-MM-DD');

  const [week, setWeek] = useState<Record<DayOfWeek, DayEntry>>(emptyWeek());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  // Which member's hours the `week` state currently holds. Loading is DERIVED
  // from this rather than being its own useState.
  //
  // Why: setting loading/error synchronously at the top of the effect below
  // triggers a second render pass before the browser paints, which is what
  // react-hooks/set-state-in-effect flags (new in eslint-plugin-react-hooks
  // v7). Deriving it means the effect only ever calls setState from inside an
  // async callback, which is the pattern that rule is steering toward. It also
  // reads more directly: "loading" IS "the data on screen isn't for this
  // member yet."
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = loadedFor !== targetId;

  // Set when the GET fails. This blocks the FORM from rendering at all, which
  // matters more than it looks: every day defaults to a prefilled 9-5, so a
  // failed load that still showed the form would present a complete, plausible
  // week that isn't this member's - and Save Week would happily write it over
  // their real hours. Refusing to edit what we couldn't read is the only safe
  // behavior. (Pre-existing hazard; the old finally{setLoading(false)} had the
  // same effect.)
  const [loadFailed, setLoadFailed] = useState(false);

  // Bumped by the retry button. It's in the effect's deps so retrying actually
  // refires the fetch - targetId alone hasn't changed, so nothing else would.
  const [reloadToken, setReloadToken] = useState(0);

  // Fetch the target's existing hours whenever the target changes (e.g. an
  // admin navigating from one member's hours page to another's without a
  // full remount). Days with no saved record just keep the emptyWeek default.
  useEffect(() => {
    if (!targetId) return;

    // Guards against a slow response for a PREVIOUS target landing after the
    // admin has already switched members and overwriting the newer data.
    // Cheap to add now that the effect has a cleanup function anyway.
    let cancelled = false;

    fetch(`${API_BASE}/api/team-members/${targetId}/hours`, { credentials: 'include' })
      .then(res => {
        // A failed request still parses as JSON, but as a { message } object
        // rather than the array below - without this check the for...of would
        // throw something unrelated instead of showing the real error.
        if (!res.ok) throw new Error('Failed to load hours');
        return res.json();
      })
      .then((hours: RecurringShift[]) => {
        if (cancelled) return;
        setWeek(() => {
          // Start from a fresh default week rather than the previous target's
          // values - otherwise an admin switching members would inherit rows
          // the new member has no record for.
          const next = emptyWeek();
          for (const record of hours) {
            // Both break fields present = a real break. A half-set pair is
            // treated as no break rather than half-loaded, matching how
            // getCurrentShiftForMember drops incomplete windows.
            const hasBreak = Boolean(record.breakStart && record.breakEnd);
            next[record.dayOfWeek] = {
              isOff: record.isOff,
              startTime: record.startTime ?? '09:00',
              endTime: record.endTime ?? '17:00',
              hasBreak,
              breakStart: record.breakStart ?? '12:00',
              breakEnd: record.breakEnd ?? '12:30',
            };
          }
          return next;
        });
        setError('');
        setLoadFailed(false);
        setLoadedFor(targetId);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadFailed(true);
        // Mark it loaded even on failure, otherwise the page sticks on
        // "Loading hours..." forever and the error never gets a chance to
        // render (the loading branch returns before it).
        setLoadedFor(targetId);
      });

    return () => { cancelled = true; };
  }, [targetId, reloadToken]);

  const updateDay = (day: DayOfWeek, patch: Partial<DayEntry>) => {
    // Clear the "Hours saved" banner as soon as anything changes, so it can't
    // sit there claiming saved while the form holds unsaved edits.
    setSavedMsg('');
    setWeek(prev => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  };

  const handleSave = async () => {
    setError('');
    setSavedMsg('');

    // Mirrors backend/src/utils/shiftValidation.ts exactly - the API enforces
    // these too (since Phase 2), this copy just gives instant feedback. If you
    // change a rule, change it in both.
    //
    // Everything below works in minutes-since-midnight and measures durations
    // FORWARD with a wrap, which is what lets an overnight shift (20:00-05:00)
    // through. A plain start < end comparison used to reject those, even
    // though the grid has always rendered them correctly.
    for (const day of DAYS) {
      const entry = week[day];
      if (entry.isOff) continue;

      const start = toMinutes(entry.startTime);
      const end = toMinutes(entry.endTime);

      if (start === null || end === null) {
        setError(`${DAY_LABELS[day]}: times must be HH:mm (e.g. 09:00)`);
        return;
      }
      // ScheduleGrid renders whole-hour blocks, so a shift boundary that
      // doesn't land on the hour would silently misrender rather than error
      // anywhere obvious.
      if (start % 60 !== 0 || end % 60 !== 0) {
        setError(`${DAY_LABELS[day]}: times must be on the hour (e.g. 09:00)`);
        return;
      }

      const shiftLength = forwardDuration(start, end);
      if (shiftLength === 0) {
        setError(`${DAY_LABELS[day]}: start and end time cannot be the same`);
        return;
      }
      if (shiftLength < 60) {
        setError(`${DAY_LABELS[day]}: shift must be at least 1 hour long`);
        return;
      }

      if (!entry.hasBreak) continue;

      // Breaks are allowed on a QUARTER hour, unlike shift times. The grid
      // draws a break as a fractional carve-out inside its hour cell, so it
      // can be finer-grained than the cell without misrendering - which a
      // shift boundary can't, since that's where a whole cell lights up.
      const breakStart = toMinutes(entry.breakStart);
      const breakEnd = toMinutes(entry.breakEnd);

      if (breakStart === null || breakEnd === null) {
        setError(`${DAY_LABELS[day]}: break times must be HH:mm (e.g. 12:00)`);
        return;
      }
      if (breakStart % 15 !== 0 || breakEnd % 15 !== 0) {
        setError(`${DAY_LABELS[day]}: break times must land on a quarter hour (e.g. 12:00, 12:15)`);
        return;
      }

      // On a same-day shift a backwards break is almost certainly a typo, so
      // name it. On an overnight shift "backwards" is meaningless - a
      // 23:45-00:15 lunch is legitimately backwards on the clock - so that
      // case falls through to the containment check, which reasons in offsets
      // from the shift start and can tell wrapping from out-of-range.
      const shiftIsOvernight = end <= start;
      if (!shiftIsOvernight && breakStart >= breakEnd) {
        setError(`${DAY_LABELS[day]}: break start must be before break end`);
        return;
      }

      const startOffset = forwardDuration(start, breakStart);
      const endOffset = forwardDuration(start, breakEnd);

      if (startOffset === endOffset) {
        setError(`${DAY_LABELS[day]}: break start must be before break end`);
        return;
      }
      if (startOffset >= shiftLength || endOffset > shiftLength || endOffset < startOffset) {
        setError(`${DAY_LABELS[day]}: break must fall inside the shift hours`);
        return;
      }
    }

    setSaving(true);
    try {
      // Whole-week replace, matching the PUT route's contract - off days
      // send no times at all so the backend's $unset clears any leftovers.
      // Off days send no times at all so the backend's $unset clears any
      // leftovers - and a day with the break unticked sends no break fields,
      // which is what makes the route $unset a lunch someone just removed.
      const payload = {
        week: DAYS.map(day => {
          const entry = week[day];
          if (entry.isOff) return { dayOfWeek: day, isOff: true };
          return {
            dayOfWeek: day,
            isOff: false,
            startTime: entry.startTime,
            endTime: entry.endTime,
            ...(entry.hasBreak ? { breakStart: entry.breakStart, breakEnd: entry.breakEnd } : {}),
          };
        }),
      };

      const res = await fetch(`${API_BASE}/api/team-members/${targetId}/hours`, {
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
  if (loading) return <div className="p-6 text-ink-muted">Loading hours...</div>;

  // Deliberately renders INSTEAD of the form - see loadFailed above. Showing a
  // prefilled default week we couldn't verify invites overwriting real data.
  if (loadFailed) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Link
          to={backTo}
          className="inline-block mb-4 text-sm text-ink-muted hover:text-white transition-colors"
        >
          ← Back
        </Link>
        <h2 className="text-2xl font-semibold text-white mb-2">
          {mode === 'self' ? 'My Hours' : `Editing Hours for ${targetMember?.name ?? '...'}`}
        </h2>
        <p className="text-dnd text-sm mb-1">Couldn't load these hours.</p>
        <p className="text-ink-muted text-sm mb-4">
          Nothing has been changed. The form is hidden on purpose - editing a
          week we couldn't read risks saving over the real one.
        </p>
        <Button
          onClick={() => {
            setLoadFailed(false);
            setLoadedFor(null);
            setReloadToken(token => token + 1);
          }}
          variant="primary" size="md"
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link
        to={backTo}
        className="inline-block mb-4 text-sm text-ink-muted hover:text-white transition-colors"
      >
        ← Back
      </Link>

      <h2 className="text-2xl font-semibold text-white mb-1">
        {mode === 'self' ? 'My Hours' : `Editing Hours for ${targetMember?.name ?? '...'}`}
      </h2>
      <p className="text-sm text-ink-muted mb-3">
        Standing weekly hours - these repeat every week until changed.
      </p>

      {/* Whose clock these inputs are in. Never stated before, and it's the
          root of the confusion the "today for them" highlight below only
          treats a symptom of: an admin setting 09:00-17:00 for a Sydney
          member is setting HER 9am, not theirs. Self mode skips it - "times
          are in your local time" on your own page is noise. */}
      {mode === 'admin' && targetNow && targetMember && (
        <div className="text-sm mb-6 bg-card border border-line rounded-xl p-3">
          <div className="text-ink">
            Times below are in <span className="text-white font-medium">{targetMember.name}'s</span>{' '}
            local time
            <span className="text-ink-faint"> ({targetMember.timezone})</span>.
          </div>
          <div className="text-ink-muted mt-1">
            Their clock: <span className="text-white">{targetNow.format('dddd, h:mm A')}</span>
            <span className="text-ink-faint"> · </span>
            Yours: <span className="text-white">{viewerNow.format('dddd, h:mm A')}</span>
            <span className="text-ink-faint"> ({formatOffset(targetNow, viewerNow)})</span>
          </div>
          {/* Only surfaced when the two clocks actually disagree about the
              date, which is the case that caused a real mis-edit (7/31 QA). */}
          {crossesDateBoundary && (
            <div className="text-away/90 mt-1.5">
              Heads up: it's already {targetNow.format('dddd')} for them, but{' '}
              {viewerNow.format('dddd')} for you.
            </div>
          )}
        </div>
      )}

      {error && <p className="text-dnd text-sm mb-4">{error}</p>}
      {savedMsg && <p className="text-ok text-sm mb-4">{savedMsg}</p>}

      <div className="space-y-3">
        {DAYS.map(day => {
          const entry = week[day];
          // Their current weekday, not the viewer's - see targetToday above.
          const isTargetToday = day === targetToday;
          return (
            <div
              key={day}
              className={`rounded-md p-3 border ${
                isTargetToday
                  ? 'bg-card border-brand/70'
                  : 'bg-card border-line'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-28 text-white font-medium text-sm">
                  {DAY_LABELS[day]}
                  {isTargetToday && (
                    <div className="text-[10px] font-normal text-brand-hover whitespace-nowrap">
                      {mode === 'admin' ? 'today for them' : 'today'}
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={entry.isOff}
                    onChange={e => updateDay(day, { isOff: e.target.checked })}
                  />
                  Off
                </label>

                <input
                  type="time"
                  className={inputClasses('sm', 'px-2 py-1 disabled:opacity-40')}
                  value={entry.startTime}
                  disabled={entry.isOff}
                  onChange={e => updateDay(day, { startTime: e.target.value })}
                />
                <span className="text-ink-faint">-</span>
                <input
                  type="time"
                  className={inputClasses('sm', 'px-2 py-1 disabled:opacity-40')}
                  value={entry.endTime}
                  disabled={entry.isOff}
                  onChange={e => updateDay(day, { endTime: e.target.value })}
                />
              </div>

              {/* Break row. Hidden entirely on off days rather than just
                  disabled - a lunch on a day someone isn't working is
                  incoherent, and the API rejects it, so offering the control
                  would be offering a dead end. */}
              {!entry.isOff && (
                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-line/40">
                  <div className="w-28" />

                  <label className="flex items-center gap-2 text-sm text-ink-muted">
                    <input
                      type="checkbox"
                      checked={entry.hasBreak}
                      onChange={e => updateDay(day, { hasBreak: e.target.checked })}
                    />
                    Lunch
                  </label>

                  <input
                    type="time"
                    step={900}
                    className={inputClasses('sm', 'px-2 py-1 disabled:opacity-40')}
                    value={entry.breakStart}
                    disabled={!entry.hasBreak}
                    onChange={e => updateDay(day, { breakStart: e.target.value })}
                  />
                  <span className="text-ink-faint">-</span>
                  <input
                    type="time"
                    step={900}
                    className={inputClasses('sm', 'px-2 py-1 disabled:opacity-40')}
                    value={entry.breakEnd}
                    disabled={!entry.hasBreak}
                    onChange={e => updateDay(day, { breakEnd: e.target.value })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        variant="primary" size="md" className="mt-6"
      >
        {saving ? 'Saving...' : 'Save Week'}
      </Button>
    </div>
  );
};

export default HoursEditor;
