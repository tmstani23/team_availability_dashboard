import ScheduleGrid from './ScheduleGrid';
import TeamStatusSidebar from './TeamStatusSidebar';

// Shared between the member's /dashboard and the admin's /admin/schedule tab -
// both routes show the exact same grid+sidebar, just reached differently
const ScheduleView = () => (
  <div className="flex w-full min-h-screen box-border bg-[#0f1112] text-white">
    <div className="flex-1 min-w-0 bg-zinc-900 text-white p-4">
      <ScheduleGrid />
    </div>
    <div className="w-[280px] shrink-0">
      <TeamStatusSidebar />
    </div>
  </div>
);

export default ScheduleView;