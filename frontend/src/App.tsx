import TeamMemberList from './components/TeamMemberList';
import AddTeamMemberForm from './components/AddTeamMemberForm';
import ScheduleGrid from './components/ScheduleGrid';
import TeamStatusSidebar from './components/TeamStatusSidebar';
import LoginForm from './components/LoginForm';
import { TeamProvider, useTeam } from './context/TeamContext';
import { AuthProvider, useAuth } from './context/AuthContext';

function DashboardContent() {
  const { handleMemberAdded } = useTeam();

  return (
    <div className="flex w-full min-h-screen box-border bg-[#0f1112] text-white">
      <div className="flex-1 min-w-0 bg-zinc-900 text-white p-4">
        <h1 className="text-3xl font-bold mb-4">Team Availability Dashboard</h1>
        <ScheduleGrid />
        <TeamMemberList />
        <AddTeamMemberForm />
      </div>
      <div className="w-[280px] shrink-0">
        <TeamStatusSidebar />
      </div>
    </div>
  );
}

// Decides whether to show the login screen or the dashboard, based on
// whether AuthContext has resolved a session yet. TeamProvider is only
// mounted once authenticated, since its fetches now require a valid cookie -
// mounting it before login would just produce 401s.
function AuthGate() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1112] text-white flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <TeamProvider>
      <DashboardContent />
    </TeamProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;