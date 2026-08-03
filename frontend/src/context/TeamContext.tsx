import { useState, useEffect, useRef, type ReactNode } from 'react';
import type { TeamMemberStatus, RecurringShift, TeamMember, Meeting } from '../types';
import { API_BASE } from '../config';
import { useRefreshTick } from '../hooks/useRefreshTick';
import { viewerDayWindow } from '../utils/scheduleTime';
// Context object + useTeam live in their own module so this file exports only
// a component, which is what Fast Refresh needs to hot-reload it.
import { TeamContext } from './useTeam';

export const TeamProvider = ({ children }: { children: ReactNode }) => {
  // Standing weekly hours (one record per member per weekday) - replaced the
  // old work-shifts fetch. This is now the only shift data the app fetches:
  // ad-hoc breaks were cut, and the standing lunch rides along on these same
  // records as breakStart/breakEnd rather than needing a second request.
  const [recurringShifts, setRecurringShifts] = useState<RecurringShift[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  // Meetings overlapping the VIEWER's current local day - the grid draws one
  // day on one clock, so that's the window worth holding (see the cross-day
  // decision in nextSteps.md). Refetched on every poll, so it follows the
  // viewer across midnight without any special handling.
  const [meetings, setMeetings] = useState<Meeting[]>([]);
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
      // The meeting window is computed here, on the client, because the
      // viewer's timezone is a client fact - the server just gets two instants
      // and returns what overlaps them. That's the cross-day decision as a
      // query rather than a filter, and it keeps the API free of any notion of
      // whose day it is.
      const window = viewerDayWindow(viewerTimezone);
      const meetingsUrl = window
        ? `${API_BASE}/api/meetings?from=${encodeURIComponent(window.from)}&to=${encodeURIComponent(window.to)}`
        : null;

      const [membersRes, shiftsRes, meetingsRes] = await Promise.all([
        fetch(`${API_BASE}/api/team-members`, { credentials: 'include' }),
        fetch(`${API_BASE}/api/recurring-shifts`, { credentials: 'include' }),
        meetingsUrl ? fetch(meetingsUrl, { credentials: 'include' }) : Promise.resolve(null)
      ]);
      // Typed unknown, not trusted as the happy-path shape: both endpoints
      // return an array on success but a { message } object on failure, so
      // these get narrowed with Array.isArray before use rather than being
      // asserted into the right type and blowing up later.
      const membersData: unknown = await membersRes.json();
      const shiftsData: unknown = await shiftsRes.json();
      const meetingsData: unknown = meetingsRes ? await meetingsRes.json() : [];

      const fetchedMembers = Array.isArray(membersData) ? (membersData as TeamMember[]) : [];

      // Re-apply any in-flight optimistic status writes over the freshly
      // polled data - see pendingStatusWrites above. Without this, a poll
      // landing mid-write clobbers the optimistic value with the pre-write
      // server state until the PATCH resolves.
      const withPendingWrites = fetchedMembers.map(member => {
        const pending = pendingStatusWrites.current.get(member._id);
        return pending ? { ...member, status: pending } : member;
      });

      setMembers(withPendingWrites);
      setRecurringShifts(Array.isArray(shiftsData) ? (shiftsData as RecurringShift[]) : []);
      setMeetings(Array.isArray(meetingsData) ? (meetingsData as Meeting[]) : []);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fires when TeamProvider mounts (which only happens after login, per
  // App.tsx's AuthGate), and again whenever the VIEWER'S TIMEZONE CHANGES.
  //
  // That second trigger is not cosmetic. The meetings request is scoped to a
  // window built from viewerTimezone (see refreshAllData), so a stale zone
  // means fetching the wrong day. Two ways that happens:
  //   1. On first load, `members` is empty, so viewerTimezone is still the
  //      'America/Chicago' fallback below - the initial fetch asks for
  //      Chicago's day, then members arrive and the real zone appears.
  //   2. Switching the "Simulating Active User" dropdown changes the zone
  //      outright.
  // Without this dep the fetched window would stay wrong until the next poll
  // (~15s), which reads as "meetings are missing/duplicated when I switch
  // timezones" - i.e. exactly like the timezone bug this phase is about,
  // while actually being a stale fetch.
  //
  // refreshAllData is deliberately NOT in the dep array: it's redefined every
  // render, so including it would refetch in a loop. The values it closes over
  // that matter here are covered by viewerTimezone.
  useEffect(() => {
    refreshAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerTimezone]);

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
    //
    // If the member isn't in the list at all there's nothing to update OR
    // roll back to - most likely they were deleted in another session between
    // the render that drew the picker and this click. Bail out rather than
    // proceeding: the rollback path would otherwise write `status: undefined`
    // into a member object on failure. (This was invisible while `members`
    // was typed `any[]`.)
    const existing = members.find(member => member._id === id);
    if (!existing) return;
    const previousStatus = existing.status;

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

  /**
   * Book a meeting. Takes instants (ISO strings) already - building them from
   * the form's date/time inputs is the form's job, and it happens exactly once
   * there rather than being re-derived here.
   *
   * NOT optimistic, unlike setStatus. A created meeting has no _id until the
   * server assigns one, and inventing a placeholder would mean a temporary row
   * that can't be deleted and a reconciliation step to write. A create is a
   * deliberate action behind a submit button, so a round-trip's wait is
   * expected in a way that a status click's isn't.
   *
   * Returns the outcome rather than throwing, so the form can render the
   * server's message - a 403 here is a real, explainable case ("you can only
   * create meetings you are attending"), not an unexpected failure.
   */
  const createMeeting = async (input: {
    title: string;
    startsAt: string;
    endsAt: string;
    attendeeIds: string[];
  }): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await fetch(`${API_BASE}/api/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input)
      });

      const data: unknown = await res.json();
      if (!res.ok) {
        const message =
          typeof data === 'object' && data !== null && 'message' in data
            ? String((data as { message: unknown }).message)
            : 'Could not create the meeting';
        return { success: false, message };
      }

      // Pull the fresh window rather than pushing the new meeting into state by
      // hand: the create may have landed outside the viewer's current day, in
      // which case it correctly shouldn't appear, and refetching is the only
      // thing that gets that right without duplicating the window logic here.
      await refreshAllData();
      return { success: true };
    } catch (err) {
      console.error('Failed to create meeting:', err);
      return { success: false, message: 'Could not reach the server' };
    }
  };

  const deleteMeeting = async (id: string): Promise<{ success: boolean; message?: string }> => {
    if (!confirm('Delete this meeting for everyone?')) return { success: false };

    // Optimistic removal with a snapshot to restore - same shape as
    // deleteMember. Unlike deleteMember, this checks res.ok: delete here can
    // legitimately be REFUSED (403, organizer-or-admin only) rather than
    // merely failing, and without the check a member clicking delete on
    // someone else's meeting would watch it vanish and then reappear on the
    // next poll with no explanation.
    const snapshot = meetings;
    setMeetings(prev => prev.filter(m => m._id !== id));

    try {
      const res = await fetch(`${API_BASE}/api/meetings/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!res.ok) {
        setMeetings(snapshot);
        const data: unknown = await res.json().catch(() => null);
        const message =
          typeof data === 'object' && data !== null && 'message' in data
            ? String((data as { message: unknown }).message)
            : 'Could not delete the meeting';
        return { success: false, message };
      }

      return { success: true };
    } catch (err) {
      console.error('Failed to delete meeting:', err);
      setMeetings(snapshot);
      return { success: false, message: 'Could not reach the server' };
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
    <TeamContext.Provider value={{ members, recurringShifts, meetings, loading, setStatus, createMeeting, deleteMeeting, deleteMember, refreshAllData, handleMemberAdded, viewerId, setViewer, viewerMember, viewerTimezone, now }}>
      {children}
    </TeamContext.Provider>
  );
};
