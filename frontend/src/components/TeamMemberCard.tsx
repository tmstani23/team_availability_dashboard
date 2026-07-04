import { useState } from 'react';
import type { TeamMember } from '../types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useTeam } from '../context/TeamContext';

dayjs.extend(utc);
dayjs.extend(timezone);

interface TeamMemberCardProps {
  member: TeamMember; // Cleaned: No extra operational method props expected here
}

const TeamMemberCard = ({ member }: TeamMemberCardProps) => {
  // Consume your preserved handlers right from the context stream
  const { toggleAvailability, deleteMember, refreshAllData } = useTeam();
  
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(member);
  const [editError, setEditError] = useState('');

  const handleToggle = () => {
    toggleAvailability(member._id, member.isAvailable);
  };

  const handleSaveEdit = async () => {
    setEditError('');

    if (!editData.name || !editData.email || !editData.timezone || !editData.role) {
      setEditError('All fields are required');
      return;
    }

    if (!editData.email.includes('@')) {
      setEditError('Please enter a valid email');
      return;
    }

    try {
      await fetch(`http://localhost:5000/api/team-members/${member._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      setIsEditing(false);
      await refreshAllData(); // Reloads both backend datasets cleanly on details change
    } catch (err) {
      setEditError('Failed to update member');
    }
  };

  return (
    <div style={{ border: '1px solid #333', padding: '1rem', borderRadius: '8px', backgroundColor: '#1e2224' }}>
      {isEditing ? (
        <div>
          <h4>Editing {member.name}</h4>
          {editError && <p style={{ color: 'red' }}>{editError}</p>}
          
          <input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
          <input value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} />
          
          <select value={editData.timezone} onChange={e => setEditData({...editData, timezone: e.target.value})}>
            <option value="America/New_York">America/New_York (Eastern)</option>
            <option value="America/Chicago">America/Chicago (Central)</option>
            <option value="America/Denver">America/Denver (Mountain)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Asia/Tokyo">Asia/Tokyo</option>
          </select>

          <input value={editData.role} onChange={e => setEditData({...editData, role: e.target.value})} />
          
          <button onClick={handleSaveEdit}>Save Changes</button>
          <button onClick={() => setIsEditing(false)}>Cancel</button>
        </div>
      ) : (
        <div>
          <h3>{member.name}</h3>
          <p><strong>Role:</strong> {member.role}</p>
          <p><strong>Timezone:</strong> {member.timezone}</p>
          <p><strong>Email:</strong> {member.email}</p>
          <p>
            <strong>Status:</strong> 
            <span style={{ color: member.isAvailable ? '#4caf50' : '#f44336' }}>
              {member.isAvailable ? '✅ Available' : '❌ Not Available'}
            </span>
          </p>
          <p><strong>Current Local Time:</strong> {dayjs().tz(member.timezone).format('hh:mm A')}</p>

          <div style={{ marginTop: '10px' }}>
            <button onClick={handleToggle}>Toggle Availability</button>
            <button onClick={() => setIsEditing(true)}>Edit</button>
            {/* Calls the centralized delete confirmation logic */}
            <button onClick={() => deleteMember(member._id)} style={{ background: '#dc3545', color: 'white' }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamMemberCard;
