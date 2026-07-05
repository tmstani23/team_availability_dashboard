import TeamMemberList from './components/TeamMemberList';
import AddTeamMemberForm from './components/AddTeamMemberForm';
import ScheduleGrid from './components/ScheduleGrid';
import TeamStatusSidebar from './components/TeamStatusSidebar';
import { TeamProvider, useTeam } from './context/TeamContext';

function DashboardContent() {
  const { handleMemberAdded } = useTeam();

  return (
    <div style={{ 
      display: 'flex', 
      width: '100%', 
      boxSizing: 'border-box', 
      minHeight: '100vh', 
      backgroundColor: '#0f1112', 
      color: '#fff' 
    }}>
      
      {/* Main Panel Content */}
      <div className="bg-blue-500 text-white p-4">
        <h1>Team Availability Dashboard</h1>
        
        <AddTeamMemberForm />
        
        {/* Cleaned: No props needed anymore! */}
        <ScheduleGrid />
        
        <TeamMemberList />
      </div>

      {/* Sidebar Content Container Layout */}
      <div style={{ width: '280px', flexShrink: 0 }}>
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
