import { useState, useEffect } from 'react';
import TeamMemberList from './components/TeamMemberList';
import AddTeamMemberForm from './components/AddTeamMemberForm';

function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleMemberAdded = () => {
    setRefreshKey(prev => prev + 1); // Trigger re-fetch in list
  };

  return (
    <div>
      <h1>Team Availability Dashboard</h1>
      
      <AddTeamMemberForm onMemberAdded={handleMemberAdded} />
      
      <TeamMemberList key={refreshKey} />
    </div>
  );
}

export default App;