import { useTeam } from '../context/TeamContext';
import TeamMemberCard from './TeamMemberCard';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TeamMemberList = () => {
  const { members, loading } = useTeam();

  // Bail out before rendering anything else while the initial fetch is
  // still in flight - members will be an empty array at this point, so
  // without this check the "No team members found" empty state would
  // flash briefly on every load
  if (loading) return <p className="text-zinc-400">Loading team members...</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-4">Team Availability Overview</h2>

      {/* Responsive card grid - auto-fill lets the browser fit as many
          300px-minimum columns as the container width allows, so this
          reflows on its own without a manual breakpoint per screen size */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {members.length === 0 ? (
          <p className="text-zinc-400">No team members found.</p>
        ) : (
          members.map(member => (
            <TeamMemberCard
              key={member._id}
              member={member}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default TeamMemberList;