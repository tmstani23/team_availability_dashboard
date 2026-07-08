import TeamMemberList from './components/TeamMemberList';
import AddTeamMemberForm from './components/AddTeamMemberForm';
import ScheduleGrid from './components/ScheduleGrid';
import TeamStatusSidebar from './components/TeamStatusSidebar';
import { TeamProvider, useTeam } from './context/TeamContext';

function DashboardContent() {
  const { handleMemberAdded } = useTeam();

  return (
    <div className="flex w-full min-h-screen box-border bg-[#0f1112] text-white">

      {/* Main Panel Content */}
      <div className="flex-1 min-w-0 bg-zinc-900 text-white p-4">
        <h1 className="text-3xl font-bold mb-4">Team Availability Dashboard</h1>

        <ScheduleGrid />
        <TeamMemberList />
        <AddTeamMemberForm />
        
      </div>

      {/* Sidebar Content Container Layout */}
      <div className="w-[280px] shrink-0">
        <TeamStatusSidebar />
      </div>

    </div>
  );
}

function App() {
  return (
    <TeamProvider>
      <DashboardContent />
    </TeamProvider>
  );
}

export default App;