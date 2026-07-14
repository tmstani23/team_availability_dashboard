import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { TeamContextType } from '../types';

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const TeamProvider = ({ children }: { children: ReactNode }) => {
  const [shifts, setShifts] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ID of the simulated "currently viewing as" user - a stand-in for real
  // auth-driven identity in parts of the UI that haven't been wired to
  // AuthContext yet (e.g. picking whose local time to display)
  const [viewerId, setViewerId] = useState<string | null>(null);

  const setViewer = (id: string) => setViewerId(id);

  // Falls back to the first member in the list if no viewer has been
  // explicitly selected yet, so the UI always has someone to display
  const viewerMember = members.find(m => m._id === viewerId) || members[0];
  const viewerTimezone = viewerMember?.timezone || 'America/Chicago';

  const refreshAllData = async () => {
    try {
      // credentials: 'include' is required on every request now - both
      // /api/team-members and /api/work-shifts are behind the authenticate
      // middleware, which reads the httpOnly session cookie. Without this
      // option, the browser won't attach that cookie cross-origin, and
      // every request 401s.
      const [membersRes, shiftsRes] = await Promise.all([
        fetch('http://localhost:5000/api/team-members', { credentials: 'include' }),
        fetch('http://localhost:5000/api/work-shifts', { credentials: 'include' })
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

  // Fires once when TeamProvider mounts (which only happens after login,
  // per App.tsx's AuthGate) - fetches the initial roster + schedule data
  useEffect(() => {
    refreshAllData();
  }, []);

  const handleMemberAdded = () => {
    refreshAllData();
  };

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    // Optimistic update: flip the UI immediately rather than waiting on the
    // network round-trip, so toggling status feels instant. If the request
    // fails below, we roll this back to the real value.
    setMembers(prev =>
      prev.map(member =>
        member._id === id ? { ...member, isAvailable: !currentStatus } : member
      )
    );

    try {
      await fetch(`http://localhost:5000/api/team-members/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isAvailable: !currentStatus })
      });
    } catch (err) {
      console.error('Failed to toggle availability:', err);
      // Rollback: request failed, so revert the optimistic flip back to
      // what it actually was before this function ran
      setMembers(prev =>
        prev.map(member =>
          member._id === id ? { ...member, isAvailable: currentStatus } : member
        )
      );
    }
  };

  const deleteMember = async (id: string) => {
    if (!confirm('Delete this team member?')) return;

    // Snapshot the current list before optimistically removing the member,
    // so we have something to restore if the DELETE request fails
    const originalMembers = [...members];
    setMembers(prev => prev.filter(member => member._id !== id));

    try {
      await fetch(`http://localhost:5000/api/team-members/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Failed to delete member:', err);
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