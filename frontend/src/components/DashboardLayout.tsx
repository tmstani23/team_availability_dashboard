// frontend/src/components/DashboardLayout.tsx
import { Outlet } from 'react-router-dom';
import AppHeader from './AppHeader';

// Mirrors AdminLayout's shell (dark background + AppHeader + Outlet) but
// passes no tabs, since /dashboard has no sub-navigation to switch between
const DashboardLayout = () => (
  <div className="min-h-screen bg-canvas text-white">
    <AppHeader />
    <Outlet />
  </div>
);

export default DashboardLayout;