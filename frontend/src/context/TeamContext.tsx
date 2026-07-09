import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { TeamContextType } from '../types';

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const TeamProvider = ({ children }: { children: ReactNode }) => {
  const [shifts, setShifts] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerId, setViewerId] = useState<string | null>(null); // ID of the "currently logged-in" simulated user

  const setViewer = (id: string) => setViewerId(id);

  // Find the viewer member
  const viewerMember = members.find(m => m._id === viewerId) || members[0];
  const viewerTimezone = viewerMember?.timezone || 'America/Chicago';

  const refreshAllData = async () => {
    try {
      const [membersRes, shiftsRes] = await Promise.all([
        fetch('http://localhost:5000/api/team-members'),
        fetch('http://localhost:5000/api/work-shifts')
      ]);
      const membersData = await membersRes.json();
      const shiftsData = await shiftsRes.json();

      setMembers(Array.isArray(membersData) ? membersData : []);
      setShifts(Array.isArray(shiftsData) ? shiftsData : []);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  const handleMemberAdded = () => {
    refreshAllData();
  };

  // 🔄 PRESERVED: Your exact background toggle with automated fallback recovery logic
  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    // 1. Instantly update global state using ._id so all layout views react in real time
    setMembers(prev =>
      prev.map(member =>
        member._id === id ? { ...member, isAvailable: !currentStatus } : member
      )
    );

    try {
      // 2. Make the API call silently in the background
      await fetch(`http://localhost:5000/api/team-members/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !currentStatus })
      });
    } catch (err) {
      console.error('Failed to toggle availability:', err);
      // 3. Rollback state instantly across all views if network request fails
      setMembers(prev =>
        prev.map(member =>
          member._id === id ? { ...member, isAvailable: currentStatus } : member
        )
      );
    }
  };

  // 🗑️ PRESERVED: Your exact deletion confirmation layout block with rollback safeguards
  const deleteMember = async (id: string) => {
    if (!confirm('Delete this team member?')) return;

    const originalMembers = [...members];
    // Optimistically remove from all UI elements instantly
    setMembers(prev => prev.filter(member => member._id !== id));

    try {
      await fetch(`http://localhost:5000/api/team-members/${id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('Failed to delete member:', err);
      // Rollback to original database snapshot if API call fails
      setMembers(originalMembers);
    }
  };

  return (
    <TeamContext.Provider value={{ members, shifts, loading, toggleAvailability, deleteMember, refreshAllData, handleMemberAdded, viewerId, setViewer, viewerMember, viewerTimezone }}>
      {children}
    </TeamContext.Provider>
  );
};

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (!context) throw new Error('useTeam must be used within a TeamProvider');
  return context;
};
