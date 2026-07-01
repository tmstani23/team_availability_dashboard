import { useState, useEffect } from 'react';
import type { TeamMember } from '../types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import TeamMemberCard from './TeamMemberCard';

dayjs.extend(utc);
dayjs.extend(timezone);

const TeamMemberList = () => {
  // Holds the list of team members loaded from backend
  const [members, setMembers] = useState<TeamMember[]>([]);
  
  // Shows loading message while data is being fetched
  const [loading, setLoading] = useState(true);

  // Reusable function to fetch latest members from backend
  const fetchMembers = () => {
    fetch('http://localhost:5000/api/team-members')
      .then(res => res.json())
      .then(data => {
        setMembers(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  // Runs once when component first loads
  useEffect(() => {
    fetchMembers();
  }, []);

  // Delete a member and refresh the list
  const deleteMember = async (id: string) => {
    if (!confirm('Delete this team member?')) return; // Simple confirmation

    try {
      await fetch(`http://localhost:5000/api/team-members/${id}`, {
        method: 'DELETE'
      });
      fetchMembers(); // Refresh list after delete
    } catch (err) {
      console.error('Failed to delete member:', err);
    }
  };

  // Toggle availability and refresh list
  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    try {
      await fetch(`http://localhost:5000/api/team-members/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !currentStatus })
      });
      fetchMembers(); // Refresh the list
    } catch (err) {
      console.error('Failed to toggle availability:', err);
    }
  };

  if (loading) return <p>Loading team members...</p>;

  return (
    <div>
      <h2>Team Availability Overview</h2>
      
      {/* Grid layout: automatically creates responsive cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {members.map(member => (
          <TeamMemberCard 
            key={member._id} 
            member={member} 
            onUpdate={fetchMembers} 
          />
        ))}
      </div>
    </div>
  );
};

export default TeamMemberList;