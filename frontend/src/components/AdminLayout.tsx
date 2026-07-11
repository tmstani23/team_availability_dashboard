import { NavLink, Outlet } from 'react-router-dom';

const AdminLayout = () => {
  // NavLink's isActive reflects whether `to` matches the current URL
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-t-lg font-medium transition-colors ${
      isActive
        ? 'bg-zinc-800 text-white'
        : 'text-zinc-400 hover:text-white'
    }`;

  return (
    <div className="min-h-screen bg-[#0f1112] text-white">
      {/* Header + tabs stay padded and width-constrained */}
      <div className="p-4">
        <h1 className="text-3xl font-bold mb-4">Team Availability Dashboard</h1>
        <nav className="flex gap-2 border-b border-zinc-700 mb-4">
          <NavLink to="/admin/schedule" className={tabClass}>
            Schedule
          </NavLink>
          <NavLink to="/admin/manage" className={tabClass}>
            Manage
          </NavLink>
        </nav>
      </div>

      {/* Outside the padded wrapper - ScheduleView needs full-width control
          for its own flex row (main content + fixed-width sidebar) */}
      <Outlet />
    </div>
  );
};

export default AdminLayout;