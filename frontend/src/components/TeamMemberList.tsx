import { useTeam } from '../context/TeamContext';
import TeamMemberCard from './TeamMemberCard';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TeamMemberList = () => {
  // Extract your live synchronizing records and global loading states straight from context
  const { members, loading } = useTeam();

  // Keep loading check safe at the bottom right before the return statement
  if (loading) return <p>Loading team members...</p>;

  return (
    <div>
      <h2>Team Availability Overview</h2>
      
      {/* Grid layout: automatically creates responsive cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {members.length === 0 ? (
          <p>No team members found.</p>
        ) : (
          members.map(member => (
            <TeamMemberCard 
              key={member._id} 
              member={member} 
              // FIXED: No extra functional attributes passed. TypeScript is happy!
            />
          ))
        )}
      </div>
    </div>
  );
};

export default TeamMemberList;
