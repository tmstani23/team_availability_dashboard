import dayjs, { type Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { formatHourLabel } from './scheduleTime';

dayjs.extend(utc);
dayjs.extend(timezone);

// Option lists for the date/time controls, so every screen builds them from
// one definition instead of several.
//
// WHY THESE EXIST. These screens used <input type="time"> and
// <input type="date">, whose popups Chrome renders as browser chrome that page
// CSS can't reach - so a dark themed field dropped a stark black panel with a
// system-grey highlight. A <select> can be themed (see the base-select block in
// index.css), and unlike a hand-rolled text input it needs no AM/PM PARSING at
// all: the options are a closed set generated here, so there is no user-typed
// text and no invalid value the control can produce. That parsing risk is what
// nextSteps.md warned about, and this sidesteps it rather than accepting it.
//
// STORAGE IS UNCHANGED. Values are 24-hour "HH:mm" and ISO "YYYY-MM-DD" -
// exactly what the API already takes. Only labels are 12-hour.

export interface SelectOption {
  value: string;
  label: string;
}

// Quarter hours, matching the step={900} the old time inputs already enforced -
// the grid draws quarter-cells and can't show finer, so this restricts nothing
// that wasn't already restricted.
export const MINUTE_STEP = 15;

/**
 * SPLIT INTO TWO FIELDS, hour and minute, rather than one list of every
 * quarter hour.
 *
 * One combined list is 96 options. That is a scroll, not a choice: picking 8AM
 * meant dragging a ~20px scrollbar thumb through a list four screens long, and
 * the popup doesn't open anywhere near the current value. Splitting gives 24 +
 * 4, both of which fit in a single popup with nothing to hunt for, and it costs
 * nothing in expressiveness - every time reachable before is still reachable.
 */

/** The 24 hours of the day as { value: "HH", label: "9AM" }. */
export function hourOptions(): SelectOption[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    value: String(hour).padStart(2, '0'),
    label: formatHourLabel(hour),
  }));
}

/**
 * Which part of the day an hour belongs to, used to group the hour popup.
 *
 * 24 options fit in one popup but still read as an undifferentiated column of
 * near-identical strings. Grouping gives the eye somewhere to land: you look
 * for "Evening" and then scan four items, instead of reading 24. The
 * boundaries are the conventional ones and don't have to be exact - they're a
 * scanning aid, not a claim about anyone's schedule.
 */
export function hourGroupLabel(hour: number): string {
  if (hour < 6) return 'Night';
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  if (hour < 21) return 'Evening';
  return 'Night';
}

/** Hour options bucketed into ordered groups, ready for <optgroup>. */
export function groupedHourOptions(): { label: string; options: SelectOption[] }[] {
  const groups: { label: string; options: SelectOption[] }[] = [];

  hourOptions().forEach((option, hour) => {
    const label = hourGroupLabel(hour);
    // Compared against the LAST group rather than searched for, so a label
    // that recurs later in the day (Night wraps around both ends) opens a
    // second group instead of jumping back into the first - options in an
    // <optgroup> must stay in clock order.
    const current = groups[groups.length - 1];
    if (current && current.label === label) current.options.push(option);
    else groups.push({ label, options: [option] });
  });

  return groups;
}

/**
 * Minutes as { value: "15", label: ":15" }.
 *
 * `current` guards against silent data loss. A stored time that isn't on a
 * quarter hour (08:37 - legal today, since the API only checks the HH:mm
 * shape) has no matching option, and a <select> with no match renders blank
 * while reading back as its first option. Saving would then rewrite that
 * record to :00 without anyone touching the field. Injecting the odd value
 * keeps it selected and the save honest; it just can't be chosen again.
 */
export function minuteOptions(current?: string): SelectOption[] {
  const options: SelectOption[] = [];
  for (let minute = 0; minute < 60; minute += MINUTE_STEP) {
    const value = String(minute).padStart(2, '0');
    options.push({ value, label: `:${value}` });
  }

  if (current && /^\d{2}$/.test(current) && Number(current) < 60 && !options.some(o => o.value === current)) {
    options.push({ value: current, label: `:${current}` });
    options.sort((a, b) => a.value.localeCompare(b.value));
  }

  return options;
}

/**
 * "HH:mm" -> its two halves. Returns null on anything malformed so the caller
 * can fall back rather than render a confidently wrong time.
 */
export function splitWallClock(value: string | undefined | null): { hour: string; minute: string } | null {
  if (!value || typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  if (Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return { hour: match[1], minute: match[2] };
}

/** The two halves back into the "HH:mm" the API stores. */
export function joinWallClock(hour: string, minute: string): string {
  return `${hour}:${minute}`;
}

/**
 * A rolling window of bookable days as { value: "YYYY-MM-DD", label }, built
 * on the VIEWER's clock - a date only means something once pinned to a zone,
 * and the one the booking form writes in is the viewer's.
 *
 * Today and tomorrow are NAMED rather than dated. A booking form is nearly
 * always used for one of those two, and "Today" is unambiguous in a way
 * "Aug 8" isn't while you're previewing another zone.
 *
 * Bounded rather than open-ended: an availability dashboard books this week,
 * not next quarter. `now` is injectable for tests.
 */
export function dayOptions(
  viewerTimezone: string | undefined,
  now: Dayjs = dayjs(),
  days = 14
): SelectOption[] {
  if (!viewerTimezone) return [];

  let start: Dayjs;
  try {
    start = now.tz(viewerTimezone).startOf('day');
  } catch {
    // dayjs throws on an unknown zone. An empty list degrades to an empty
    // control rather than taking the form down.
    return [];
  }
  if (!start.isValid()) return [];

  return Array.from({ length: days }, (_, offset) => {
    const day = start.add(offset, 'day');
    const label =
      offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : day.format('ddd, MMM D');
    return { value: day.format('YYYY-MM-DD'), label };
  });
}
