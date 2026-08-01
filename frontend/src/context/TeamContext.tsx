import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import type { TeamContextType, TeamMemberStatus, RecurringShift } from '../types';
import { API_BASE } from '../config';
import { useRefreshTick } from '../hooks/useRefreshTick';

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const TeamProvider = ({ children }: { children: ReactNode }) => {
  // Standing weekly hours (one record per member per weekday) - replaced the
  // old work-shifts fetch. One-off dated breaks (WorkShift) come back as their
  // own fetch when the break-logging UI lands (see nextSteps.md).
  const [recurringShifts, setRecurringShifts] = useState<RecurringShift[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Race fix (Phase 1): setStatus does an optimistic update, then awaits the
  // PATCH. A poll (every ~15s, see useRefreshTick) can land in that window
  // and overwrite the optimistic value with the still-old server value,
  // flickering the UI back until the PATCH itself resolves. Fix chosen: skip
  // applying poll results for a member's status field while that member has
  // a write in flight, rather than versioning responses. Simpler, and the
  // in-flight window is short (one PATCH), so nothing else needs to be
  // deferred - just the one field being written.
  //
  // Keyed by member id -> the optimistic status currently in flight, so
  // refreshAllData can re-apply it over whatever the poll just fetched.
  const pendingStatusWrites = useRef<Map<string, TeamMemberStatus>>(new Map());

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
      // /api/team-members and /api/recurring-shifts are behind the authenticate
      // middleware, which reads the httpOnly session cookie. Without this
      // option, the browser won't attach that cookie cross-origin, and
      // every request 401s.
      const [membersRes, shiftsRes] = await Promise.all([
        fetch(`${API_BASE}/api/team-members`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/recurring-shifts`, { credentials: 'include' })
      ]);
      const membersData = await membersRes.json();
      const shiftsData = await shiftsRes.json();

      // Re-apply any in-flight optimistic status writes over the freshly
      // polled data - see pendingStatusWrites above. Without this, a poll
      // landing mid-write clobbers the optimistic value with the pre-write
      // server state until the PATCH resolves.
      const withPendingWrites = Array.isArray(membersData)
        ? membersData.map((member: any) =>
            pendingStatusWrites.current.has(member._id)
              ? { ...member, status: pendingStatusWrites.current.get(member._id) }
              : member
          )
        : [];

      setMembers(withPendingWrites);
      setRecurringShifts(Array.isArray(shiftsData) ? shiftsData : []);
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

  // Single polling seam for the whole app (see useRefreshTick.ts) - one
  // interval here, shared via context, rather than every consumer setting up
  // its own. `now` ticks every POLL_INTERVAL_MS alongside the refetch, so
  // components deriving status from the clock (getScheduleState, the
  // heartbeat layer) re-evaluate against a fresh timestamp instead of one
  // captured once at mount - that's what actually closes the "stale status
  // in an open tab" bug, not the refetch alone.
  const now = useRefreshTick(refreshAllData);

  const handleMemberAdded = () => {
    refreshAllData();
  };

  const setStatus = async (id: string, newStatus: TeamMemberStatus) => {
    // Capture the current status BEFORE the optimistic update so we have a
    // real value to roll back to if the request fails. (The old toggle could
    // derive the rollback value by flipping a boolean; with four states we
    // have to remember what it actually was.)
    const previousStatus = members.find(member => member._id === id)?.status;

    // Mark this member's write as in-flight so a poll landing before the
    // PATCH resolves doesn't overwrite the optimistic value (see
    // pendingStatusWrites above).
    pendingStatusWrites.current.set(id, newStatus);

    // Optimistic update: change the UI immediately rather than waiting on the
    // network round-trip, so setting status feels instant.
    setMembers(prev =>
      prev.map(member =>
        member._id === id ? { ...member, status: newStatus } : member
      )
    );

    try {
      await fetch(`${API_BASE}/api/team-members/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });
    } catch (err) {
      console.error('Failed to set status:', err);
      // Rollback: request failed, so revert to whatever the status was
      // before this function ran.
      setMembers(prev =>
        prev.map(member =>
          member._id === id ? { ...member, status: previousStatus } : member
        )
      );
    } finally {
      // Write is settled (success or failure) - polls are free to reflect
      // the real server state for this member again.
      pendingStatusWrites.current.delete(id);
    }
  };

  const deleteMember = async (id: string) => {
    if (!confirm('Delete this team member?')) return;

    // Snapshot the current list before optimistically removing the member,
    // so we have something to restore if the DELETE request fails
    const originalMembers = [...members];
    setMembers(prev => prev.filter(member => member._id !== id));

    try {
      await fetch(`${API_BASE}/api/team-members/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Failed to delete member:', err);
      setMembers(originalMembers);
    }
  };

  return (
    <TeamContext.Provider value={{ members, recurringShifts, loading, setStatus, deleteMember, refreshAllData, handleMemberAdded, viewerId, setViewer, viewerMember, viewerTimezone, now }}>
      {children}
    </TeamContext.Provider>
  );
};

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (!context) throw new Error('useTeam must be used within a TeamProvider');
  return context;
};