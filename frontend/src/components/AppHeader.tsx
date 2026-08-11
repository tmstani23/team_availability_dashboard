// frontend/src/components/AppHeader.tsx
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import type { ReactNode } from 'react';
import Button from './Button';
import { buttonClasses } from '../utils/ui';

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
      {/* Wraps rather than squeezing: the title and the two controls both have
          a minimum they can't go below, so on a phone they stack instead of
          overlapping. The title also steps down a size below sm - "Team
          Availability Dashboard" at text-3xl takes three lines on a 375px
          screen and pushes everything else off the first fold. */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl sm:text-3xl font-bold">Team Availability Dashboard</h1>
        <div className="flex items-center gap-2">
          {/* Every logged-in user has their own hours and timezone to manage,
              admin or not - lives outside the tabs slot since it's not
              route-specific the way Schedule/Manage are */}
          <Link
            to="/profile"
            className={buttonClasses('secondary', 'md')}
          >
            My Profile
          </Link>
          <Button onClick={handleLogout} size="md">
            Logout
          </Button>
        </div>
      </div>

      {/* Only rendered when a route passes tabs in - keeps the tab bar out
          of /dashboard, which has no sub-navigation */}
      {tabs && (
        <nav className="flex flex-wrap gap-2 border-b border-line mb-4">
          {tabs}
        </nav>
      )}
    </div>
  );
};

export default AppHeader;