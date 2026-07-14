import { NavLink, Outlet } from 'react-router-dom';
import AppHeader from './AppHeader';

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
      {/* Tabs built here (they're admin-specific) and handed to AppHeader's
          generic tabs slot - AppHeader itself doesn't know about routes */}
      <AppHeader
        tabs={
          <>
            <NavLink to="/admin/schedule" className={tabClass}>
              Schedule
            </NavLink>
            <NavLink to="/admin/manage" className={tabClass}>
              Manage
            </NavLink>
          </>
        }
      />

      {/* Outside the padded wrapper - ScheduleView needs full-width control
          for its own flex row (main content + fixed-width sidebar) */}
      <Outlet />
    </div>
  );
};

export default AdminLayout;