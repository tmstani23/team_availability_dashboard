import { useState } from 'react';
import ScheduleGrid from './ScheduleGrid';
import TeamStatusSidebar from './TeamStatusSidebar';
import TeamHoursPanel from './TeamHoursPanel';

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
    <div className="flex w-full min-h-screen box-border bg-[#0f1112] text-white">
      <div className="flex-1 min-w-0 bg-zinc-900 text-white p-4">
        <TeamHoursPanel selectedIds={selectedIds} onToggle={toggleSelected} />
        <ScheduleGrid selectedIds={selectedIds} />
      </div>
      <div className="w-[280px] shrink-0 flex flex-col">
        <TeamStatusSidebar />
      </div>
    </div>
  );
};

export default ScheduleView;