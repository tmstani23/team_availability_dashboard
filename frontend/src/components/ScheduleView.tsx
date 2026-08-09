import { useState } from 'react';
import ScheduleGrid from './ScheduleGrid';
import TeamStatusSidebar from './TeamStatusSidebar';
import TeamHoursPanel from './TeamHoursPanel';
import MeetingPanel from './MeetingPanel';
import TimezonePreview from './TimezonePreview';

// Shared between the member's /dashboard and the admin's /admin/schedule tab -
// both routes show the exact same grid+sidebar, just reached differently
const ScheduleView = () => {
  // Which members are checked for the Overlap Finder. Local UI state for
  // this view, not team data other screens need - so it's useState here
  // rather than lifted into TeamContext (see nextSteps.md).
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelected = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(existingId => existingId !== id) : [...prev, id]
    );
  };

  return (
    // Stacks below lg, side-by-side above it. Was an unconditional flex row,
    // so on a phone the 280px sidebar and the grid squeezed each other and
    // neither was usable. Column order puts the grid FIRST and the roster
    // below it, matching the desktop reading order (main content, then the
    // sidebar) rather than making someone scroll past the whole roster to
    // reach the thing they opened the page for.
    <div className="flex flex-col lg:flex-row w-full min-h-screen box-border bg-canvas text-white">
      <div className="flex-1 min-w-0 bg-surface text-white p-4">
        {/* Sits at the very top because it governs everything below it that
            DISPLAYS hours. That it sits above MeetingPanel and still doesn't
            affect it is the point made visible: booking keeps its own zone
            label and its own clock. */}
        <TimezonePreview />
        <TeamHoursPanel selectedIds={selectedIds} onToggle={toggleSelected} />
        {/* Sits between the finder and the grid on purpose: find the overlap
            above, book it here, see it drawn below. That sequence is the
            feature - the finder used to stop at step one and hand you to an
            external calendar. */}
        <MeetingPanel selectedIds={selectedIds} />
        <ScheduleGrid selectedIds={selectedIds} />
      </div>
      {/* Full width when stacked, the fixed 280px column once side-by-side.
          w-[280px] alone made this a 280px strip on a 375px phone with the
          grid crushed beside it. */}
      <div className="w-full lg:w-[280px] shrink-0 flex flex-col">
        <TeamStatusSidebar />
      </div>
    </div>
  );
};

export default ScheduleView;