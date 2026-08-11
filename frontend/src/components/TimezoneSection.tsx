import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useTeam } from '../context/useTeam';
import { formatTimezoneLabel } from '../utils/scheduleTime';
import { TIMEZONE_OPTIONS, isCuratedTimezone } from '../utils/timezones';
import ThemedSelect from './ThemedSelect';
import Button from './Button';

// Self-service timezone, on the member's own profile page.
//
// It sits ABOVE the week grid rather than beside it or on its own page, and
// that placement is the argument: "09:00" is meaningless without the zone it's
// in. HoursEditor's self mode deliberately SKIPS the timezone context panel
// that admin mode shows, on the grounds that "times are in your local time" is
// noise on your own page - but that's exactly the assumption a stale stored
// zone breaks. Stating the zone here, editable, turns the skipped panel into a
// fact you can correct.
const TimezoneSection = () => {
  const { teamMemberId } = useAuth();
  const { members, setTimezone, browserTimezone } = useTeam();

  const member = members.find(m => m._id === teamMemberId);
  const storedTimezone = member?.timezone ?? '';

  const [selected, setSelected] = useState(storedTimezone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The stored value can legitimately sit outside the curated list - set before
  // that list existed, or written straight to the API. Appending it keeps the
  // select from silently rendering someone else's zone as if it were theirs,
  // which is the drift bug TIMEZONE_OPTIONS exists to prevent.
  const options = isCuratedTimezone(storedTimezone)
    ? TIMEZONE_OPTIONS
    : [...TIMEZONE_OPTIONS, { value: storedTimezone, label: storedTimezone }];

  // Compared as IANA STRINGS, never offsets - two zones can share an offset and
  // one zone changes its own twice a year, so an offset comparison would flash
  // a false mismatch at every DST change. Same rule as the sidebar's hint.
  const deviceDiffers = !!browserTimezone && browserTimezone !== storedTimezone;
  const isDirty = selected !== storedTimezone;

  // Nothing to edit until the roster resolves the logged-in member. An admin
  // badge with no linked teamMemberId never resolves one, so this also covers
  // the case where there is genuinely no personal profile to edit.
  if (!member) return null;

  const handleSave = async () => {
    if (!isDirty || !teamMemberId) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const result = await setTimezone(teamMemberId, selected);

    setSaving(false);
    if (result.success) {
      setSaved(true);
    } else {
      // Revert the control to the stored value. Leaving a failed selection
      // sitting in the select would misreport the saved state as changed.
      setSelected(storedTimezone);
      setError(result.message ?? 'Could not update your timezone');
    }
  };

  return (
    <section className="mb-6 bg-card border border-line rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-1">Timezone</h3>

      {/* States the consequence plainly instead of gating the change behind a
          confirm dialog. Changing your own zone retimes you for the whole team,
          which changing your own status doesn't - so the asymmetry gets said
          out loud. But a confirm step is friction on a FIX: this is the control
          someone reaches for when something is already wrong, and making them
          confirm twice punishes the repair rather than the mistake. */}
      <p className="text-sm text-ink-muted mb-3">
        Your hours below are stored in this zone, and it decides when the rest of
        the team sees you as on shift.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <ThemedSelect
          label="Your timezone"
          value={selected}
          onChange={value => {
            setSelected(value);
            // Any edit invalidates the previous outcome - leaving "Saved" up
            // next to a changed selection would claim the new value is stored.
            setSaved(false);
            setError(null);
          }}
          disabled={saving}
          className="min-w-[16rem]"
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </ThemedSelect>

        <Button onClick={handleSave} disabled={!isDirty || saving} size="md">
          {saving ? 'Saving...' : 'Save timezone'}
        </Button>

        {saved && !isDirty && (
          <span className="text-sm text-ok">Saved</span>
        )}
      </div>

      {error && <p className="text-dnd text-sm mt-2">{error}</p>}

      {/* The same disagreement the sidebar names, surfaced where it can be
          acted on. Only shown when the browser actually answered: if we fell
          back to the stored zone, calling it the device's would be a lie. */}
      {deviceDiffers && !isDirty && (
        <p className="mt-3 text-[11px] text-away leading-snug">
          This device is set to {formatTimezoneLabel(browserTimezone) || browserTimezone}.
          Your schedule is being shown on that clock, but your team sees you on
          the zone above.
        </p>
      )}
    </section>
  );
};

export default TimezoneSection;
