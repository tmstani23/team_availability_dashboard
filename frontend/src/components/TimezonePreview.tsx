import { useTeam } from '../context/useTeam';
import { formatTimezoneLabel } from '../utils/scheduleTime';
import Button from './Button';
import ThemedSelect from './ThemedSelect';

// Previews a ZONE, not a PERSON. See the DISPLAY vs WRITE comment in
// TeamContext - the short version is that the retired "simulate as user"
// dropdown implied an identity, and this deliberately doesn't: "show me this
// grid in Berlin" says nothing about who you are, so it needs no admin gate
// and reintroduces no impersonation.
//
// It's also a real feature rather than debug scaffolding. "What does my team's
// day look like in Berlin before I schedule this?" is a question a user of an
// availability dashboard actually has.

const TimezonePreview = () => {
  const { members, viewerTimezone, previewTimezone, setPreviewTimezone } = useTeam();

  // The team's own zones, deduped, plus the viewer's own so "back to mine" is
  // always reachable from the list itself. Sorted by the city label rather
  // than the IANA string so the dropdown reads alphabetically by what's
  // actually printed ("Berlin" before "Chicago", not "America/..." first).
  const zones = Array.from(new Set([viewerTimezone, ...members.map(m => m.timezone)]))
    .filter((tz): tz is string => Boolean(tz))
    .sort((a, b) => formatTimezoneLabel(a).localeCompare(formatTimezoneLabel(b)));

  const isPreviewing = previewTimezone !== null;

  return (
    <div className="w-full bg-surface border-b border-line p-4 box-border">
      <div className="flex flex-wrap items-center gap-2">
        {/* A span, not a <label htmlFor>. ThemedSelect owns its own <select>
            and doesn't take an id, so htmlFor pointed at nothing - the select
            carries its accessible name through aria-label instead. */}
        <span className="text-sm font-semibold text-ink">View schedule in</span>
        <ThemedSelect
          // The empty string is the "my own clock" option. It maps to null
          // rather than to viewerTimezone so the two states stay
          // distinguishable - previewing your OWN zone should still read as
          // "not previewing", or the banner would fire on a no-op.
          value={previewTimezone ?? ''}
          onChange={value => setPreviewTimezone(value || null)}
          label="View schedule in timezone"
          className="w-[13rem]"
        >
          <option value="">
            My timezone ({formatTimezoneLabel(viewerTimezone) || viewerTimezone})
          </option>
          {zones.map(tz => (
            <option key={tz} value={tz}>
              {formatTimezoneLabel(tz) || tz}
            </option>
          ))}
        </ThemedSelect>

        {isPreviewing && (
          <Button onClick={() => setPreviewTimezone(null)} variant="outline" size="sm">
            Back to my timezone
          </Button>
        )}
      </div>

      {/* PERSISTENT while a preview is active, and it has to be. The grid's
          columns look identical in every zone - only the blocks move - so
          without a standing marker there is nothing on screen distinguishing
          "Tokyo's day" from "my day", and the two are the same shape. Amber
          rather than brand: this is a state to notice, not a thing to click.

          It also states the booking exception out loud. MeetingPanel keeps
          reading the real viewer zone by design, so the one thing a reader
          could reasonably assume here - that a preview changes what "2pm"
          means when they book - is exactly the thing that isn't true. */}
      {isPreviewing && (
        <div className="mt-2 text-xs text-away leading-snug">
          Previewing {formatTimezoneLabel(previewTimezone) || previewTimezone} — the schedule
          below is drawn on that clock. Meetings are still booked in your own timezone
          ({formatTimezoneLabel(viewerTimezone) || viewerTimezone}).
        </div>
      )}
    </div>
  );
};

export default TimezonePreview;
