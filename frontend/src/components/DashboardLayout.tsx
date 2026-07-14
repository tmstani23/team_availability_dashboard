// frontend/src/components/DashboardLayout.tsx
import { Outlet } from 'react-router-dom';
import AppHeader from './AppHeader';

// Mirrors AdminLayout's shell (dark background + AppHeader + Outlet) but
// passes no tabs, since /dashboard has no sub-navigation to switch between
const DashboardLayout = () => (
  <div className="min-h-screen bg-[#0f1112] text-white">
    <AppHeader />
    <Outlet />
  </div>
);

export default DashboardLayout;