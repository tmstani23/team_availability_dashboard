// frontend/src/components/AppHeader.tsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

interface AppHeaderProps {
  // Optional nav tabs slot - AdminLayout passes its Schedule/Manage NavLinks
  // in here; DashboardLayout renders the header with no tabs at all
  tabs?: ReactNode;
}

const AppHeader = ({ tabs }: AppHeaderProps) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout(); // clears httpOnly cookie server-side + resets local auth state
    // replace: true so the back button can't land the user back on a
    // protected page after their session is gone
    navigate('/login', { replace: true });
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Team Availability Dashboard</h1>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 rounded text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Only rendered when a route passes tabs in - keeps the tab bar out
          of /dashboard, which has no sub-navigation */}
      {tabs && (
        <nav className="flex gap-2 border-b border-zinc-700 mb-4">
          {tabs}
        </nav>
      )}
    </div>
  );
};

export default AppHeader;