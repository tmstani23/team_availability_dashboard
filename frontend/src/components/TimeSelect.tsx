import ThemedSelect from './ThemedSelect';
import {
  groupedHourOptions,
  minuteOptions,
  splitWallClock,
  joinWallClock,
} from '../utils/timeOptions';

// A time picker as TWO fields - hour, then minute.
//
// Replaces <input type="time">, whose popup is browser chrome page CSS can't
// reach, and replaces the single 96-option quarter-hour list that briefly
// stood in for it. That list was technically complete and practically a
// scroll: every quarter hour of the day is four screens of near-identical
// strings, opened nowhere near your current value. 24 + 4 fits in one popup
// each, and no time that was reachable before became unreachable.
//
// CONTRACT: `value` in and out is 24-hour "HH:mm" - the same string the native
// input produced and the same string the API stores. The split is a rendering
// concern that never escapes this component.

interface TimeSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
  /**
   * How fine the caller is allowed to go, and it is NOT cosmetic - it mirrors
   * a rule both HoursEditor and shiftValidation.ts already enforce:
   *
   *   'hour'    - SHIFT boundaries. ScheduleGrid lights whole hour cells, so a
   *               shift starting at 8:15 has no cell to half-light and would
   *               silently misrender. Rejected by the API with "times must be
   *               on the hour".
   *   'quarter' - BREAKS and meetings. Both are drawn as fractional carve-outs
   *               INSIDE an hour cell, so they can be finer than the cell
   *               without misrendering.
   *
   * Offering minutes on an hour-only field isn't a cosmetic slip: every one of
   * :15/:30/:45 is a choice the save will refuse, so the control would be
   * advertising three guaranteed errors.
   */
  granularity?: 'hour' | 'quarter';
}

const HOUR_GROUPS = groupedHourOptions();

const TimeSelect = ({
  value,
  onChange,
  disabled,
  label,
  granularity = 'quarter',
}: TimeSelectProps) => {
  // A value the API shouldn't have stored still has to render as SOMETHING.
  // Falling back to midnight shows a readable control without writing
  // anything - onChange only fires on a real interaction, so the bad value
  // survives in state until someone deliberately replaces it.
  const parts = splitWallClock(value) ?? { hour: '00', minute: '00' };
  const isHourOnly = granularity === 'hour';

  // On an hour-only field the minute is FORCED to :00 rather than carried
  // through. A legacy record holding 08:30 (predating the on-the-hour rule)
  // would otherwise pick up a new hour and stay half-past - producing 09:30,
  // which the save then rejects. Normalising on change means touching the
  // control is also how you repair such a record.
  const emit = (hour: string, minute: string) =>
    onChange(joinWallClock(hour, isHourOnly ? '00' : minute));

  return (
    <span className="inline-flex items-center gap-1">
      <ThemedSelect
        value={parts.hour}
        disabled={disabled}
        label={`${label} hour`}
        className={isHourOnly ? 'w-[6rem]' : 'w-[5.25rem]'}
        onChange={hour => emit(hour, parts.minute)}
      >
        {/* Grouped by part of day. 24 options fit without scrolling but still
            read as one undifferentiated column; the headers give the eye
            somewhere to land. They only render as real headers on browsers
            with base-select - elsewhere they're the native optgroup, which is
            still an improvement over none. */}
        {HOUR_GROUPS.map(group => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </ThemedSelect>

      {/* No minute field at all when the caller is hour-only. Rendering it
          disabled would be worse than omitting it - a greyed ":00" implies a
          choice exists somewhere, and for a shift boundary it doesn't. */}
      {!isHourOnly && (
        <ThemedSelect
          value={parts.minute}
          disabled={disabled}
          label={`${label} minute`}
          className="w-[4.25rem]"
          onChange={minute => emit(parts.hour, minute)}
        >
          {/* parts.minute is passed in so an off-quarter stored value (08:37)
              still appears and stays selected, rather than rendering blank and
              silently saving as :00 on the next write. */}
          {minuteOptions(parts.minute).map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </ThemedSelect>
      )}
    </span>
  );
};

export default TimeSelect;
