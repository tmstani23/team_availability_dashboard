import { useState, useEffect } from 'react';
import TeamMemberList from './components/TeamMemberList';
import AddTeamMemberForm from './components/AddTeamMemberForm';
import ScheduleGrid from './components/ScheduleGrid';

function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [shifts, setShifts] = useState([]);
  const [members, setMembers] = useState([]);
  
  useEffect(() => {
  fetch('http://localhost:5000/api/team-members')
    .then(res => res.json())
    .then(setMembers);
  }, []);

  useEffect(() => {
  fetch('http://localhost:5000/api/work-shifts')
    .then(res => res.json())
    .then(setShifts);
  }, []);

  const handleMemberAdded = () => {
    setRefreshKey(prev => prev + 1); // Trigger re-fetch in list
  };

  return (
    <div>
      <h1>Team Availability Dashboard</h1>
      
      <AddTeamMemberForm onMemberAdded={handleMemberAdded} />
      <ScheduleGrid members={members} shifts={shifts} />
      <TeamMemberList key={refreshKey} />
    </div>
  );
}

export default App;