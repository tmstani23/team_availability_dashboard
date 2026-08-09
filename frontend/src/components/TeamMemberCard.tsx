import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { TeamMember } from '../types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useTeam } from '../context/useTeam';
import { STATUS_META, SETTABLE_STATUSES, resolveDisplayStatus } from '../utils/status';
import {
  getCurrentShiftForMember,
  getScheduleState,
  meetingsForMember,
  isMeetingInProgress,
} from '../utils/scheduleTime';
import { HEARTBEAT_STALE_MS } from '../hooks/useRefreshTick';
import { inputClasses, buttonClasses } from '../utils/ui';
import Button from './Button';
import { API_BASE } from '../config';

dayjs.extend(utc);
dayjs.extend(timezone);

interface TeamMemberCardProps {
  member: TeamMember;
}

// Shared input styling so edit mode + the password field match
// AddTeamMemberForm's look instead of drifting apart over time
const inputClass = inputClasses('sm', 'w-full');

const TeamMemberCard = ({ member }: TeamMemberCardProps) => {
  const { setStatus, deleteMember, refreshAllData, recurringShifts, meetings, now } = useTeam();

  // Same derivation the sidebar does, so the two views can't disagree about
  // what a member's status is. Off shift shows offline regardless of what
  // they set; the picker below still reflects their stored choice. `now`
  // comes from useRefreshTick (via context) rather than a fresh dayjs() call
  // here, so this recomputes on every poll tick instead of freezing at
  // whatever moment the card first rendered.
  const resolution = getCurrentShiftForMember(member._id, recurringShifts, member.timezone, now);
  const lastSeenAtMs = member.lastSeenAt ? new Date(member.lastSeenAt).getTime() : undefined;
  // Same instant test the sidebar runs. No timezone needed - a meeting is
  // stored as an instant, so "is it happening now" is a plain comparison.
  const inMeeting = meetingsForMember(meetings, member._id)
    .some(m => isMeetingInProgress(m, now));
  const displayStatus = resolveDisplayStatus(
    member.status,
    getScheduleState(resolution, member.timezone, now),
    inMeeting,
    lastSeenAtMs,
    now.valueOf(),
    HEARTBEAT_STALE_MS
  );

  // Profile edit (name/timezone/job role) - PUT /:id
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(member);
  const [editError, setEditError] = useState('');

  // Login info - email + admin/member access level, fetched on demand from
  // GET /:id/badge rather than included in the main roster fetch, so that
  // endpoint stays as narrow as it's always been
  const [badgeInfo, setBadgeInfo] = useState<{ email: string; role: 'admin' | 'member' } | null>(null);
  const [showBadge, setShowBadge] = useState(false);
  const [badgeError, setBadgeError] = useState('');

  // Role promotion/demotion - acts on the UserBadge via PATCH /:id/role,
  // grouped with badge state since it only makes sense once badgeInfo exists
  const [roleMsg, setRoleMsg] = useState('');
  const [roleUpdating, setRoleUpdating] = useState(false);

  // Password reset - PATCH /:id/password. Admin override, no
  // current-password check required (that's enforced server-side by
  // requireAdmin, not by asking for the old password here)
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const handleSaveEdit = async () => {
    setEditError('');

    if (!editData.name || !editData.timezone || !editData.role) {
      setEditError('All fields are required');
      return;
    }

    try {
      await fetch(`${API_BASE}/api/team-members/${member._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // sends the httpOnly cookie so authenticate + requireAdmin can verify this request
        body: JSON.stringify(editData)
      });
      setIsEditing(false);
      await refreshAllData(); // pulls fresh data rather than patching local state manually
    } catch {
      setEditError('Failed to update member');
    }
  };

  const handleViewBadge = async () => {
    // Already have the data - just toggle visibility instead of re-fetching.
    // Login info won't change without a page reload, so re-fetching on every
    // click would be wasted work
    if (badgeInfo) {
      setShowBadge(prev => !prev);
      return;
    }

    setBadgeError('');
    try {
      const res = await fetch(`${API_BASE}/api/team-members/${member._id}/badge`, {
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Failed to fetch login info');

      const data = await res.json();
      setBadgeInfo(data);
      setShowBadge(true);
    } catch {
      setBadgeError('Failed to load login info');
    }
  };

  const handleRoleToggle = async () => {
    if (!badgeInfo) return; // panel can't be open without this, but guards against a stray call

    const newRole = badgeInfo.role === 'admin' ? 'member' : 'admin';
    setRoleMsg('');
    setRoleUpdating(true); // disables the button below so a slow request can't be double-clicked

    try {
      const res = await fetch(`${API_BASE}/api/team-members/${member._id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role: newRole })
      });

      const data = await res.json();

      if (!res.ok) {
        // Surfaces the backend's actual reason (e.g. "Cannot demote the
        // last remaining admin") instead of a generic failure message
        throw new Error(data?.message || 'Failed to update role');
      }

      setBadgeInfo({ ...badgeInfo, role: newRole }); // update in place, no need to re-fetch the whole badge
    } catch (err) {
      setRoleMsg(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setRoleUpdating(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordError(false);

    // Client-side check mirrors the backend's 8-char minimum so an invalid
    // password fails instantly instead of waiting on a round trip
    if (newPassword.length < 8) {
      setPasswordMsg('Password must be at least 8 characters');
      setPasswordError(true);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/team-members/${member._id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.message || 'Failed to reset password');

      setPasswordMsg('Password updated');
      setPasswordError(false);
      setNewPassword(''); // clear immediately so the new password doesn't linger visible on screen
    } catch (err) {
      setPasswordMsg(err instanceof Error ? err.message : 'Failed to reset password');
      setPasswordError(true);
    }
  };

  return (
    <div className="bg-card border border-line rounded-xl p-4 shadow-lg">
      {isEditing ? (
        // Edit mode - profile fields only (name/timezone/job role), not
        // login credentials - those live in the badge panel below instead
        <div className="space-y-3">
          <h4 className="text-lg font-semibold text-white">Editing {member.name}</h4>
          {editError && <p className="text-dnd text-sm">{editError}</p>}

          <div>
            <label className="block text-sm text-ink-muted mb-1">Name</label>
            <input
              className={inputClass}
              value={editData.name}
              onChange={e => setEditData({ ...editData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm text-ink-muted mb-1">Timezone</label>
            <select
              className={inputClass}
              value={editData.timezone}
              onChange={e => setEditData({ ...editData, timezone: e.target.value })}
            >
              <option value="America/New_York">America/New_York (Eastern)</option>
              <option value="America/Chicago">America/Chicago (Central)</option>
              <option value="America/Denver">America/Denver (Mountain)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-ink-muted mb-1">Job Role</label>
            <input
              className={inputClass}
              value={editData.role}
              onChange={e => setEditData({ ...editData, role: e.target.value })}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleSaveEdit}
              variant="primary" size="md"
            >
              Save Changes
            </Button>
            <Button
              onClick={() => setIsEditing(false)}
              variant="secondary" size="md"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <h3 className="text-lg font-semibold text-white">{member.name}</h3>
          <div className="text-sm text-ink space-y-0.5 mt-1">
            {/* "Job Role" (member.role, e.g. "Engineer") is a different field
                from "Access Level" (badgeInfo.role, admin/member) below -
                same word, two unrelated concepts, labeled distinctly to avoid confusion */}
            <p><span className="text-ink-muted">Job Role:</span> {member.role}</p>
            <p><span className="text-ink-muted">Timezone:</span> {member.timezone}</p>
            <p>
              <span className="text-ink-muted">Status:</span>{' '}
              {/* Derived, not raw - matches what the sidebar shows this member
                  as. resolveDisplayStatus also covers the missing-status case
                  (pre-migration records) by falling back to 'away'. */}
              <span>{STATUS_META[displayStatus].label}</span>
              {/* Names the actual reason for the override rather than always
                  saying "off shift" - three different things can derive a
                  status now, and only one of them is the schedule. */}
              {displayStatus !== member.status && !!member.status && (
                <span className="text-ink-faint">
                  {' '}({displayStatus === 'meeting' ? 'in a meeting' : displayStatus === 'break' ? 'at lunch' : 'off shift'}
                  {' '}— set {STATUS_META[member.status].label})
                </span>
              )}
            </p>
            {/* `now` from context rather than a fresh dayjs() here, so this
                ticks with the poll instead of freezing at first render - the
                same fix the sidebar clock got. tnum keeps the digits
                fixed-width so the line doesn't shuffle as the minute rolls. */}
            <p className="tnum"><span className="text-ink-muted">Current Local Time:</span> {now.tz(member.timezone).format('h:mm A')}</p>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {/* Status picker - an admin can set any member's status here
                (backend allows admin override). Same shared STATUS_META /
                SETTABLE_STATUSES the sidebar uses. offline is omitted because
                it's schedule-derived, not hand-set. */}
            {SETTABLE_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setStatus(member._id, s)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                  member.status === s
                    ? STATUS_META[s].pill
                    : 'bg-line text-ink border-transparent hover:bg-line-strong'
                }`}
              >
                {STATUS_META[s].short}
              </button>
            ))}
            <Button
              onClick={() => setIsEditing(true)}
              variant="secondary" size="md"
            >
              Edit
            </Button>
            {/* Admin override of this member's standing hours - same
                HoursEditor component as /profile/hours, just targeting
                their :id instead of the admin's own */}
            <Link
              to={`/members/${member._id}/hours`}
              className={buttonClasses('secondary', 'md')}
            >
              Edit Hours
            </Link>
            <Button
              onClick={handleViewBadge}
              variant="secondary" size="md"
            >
              {showBadge ? 'Hide Login Info' : 'View Login Info'}
            </Button>
            {/* Centralized delete confirmation logic lives in TeamContext */}
            <Button
              onClick={() => deleteMember(member._id)}
              variant="danger" size="md"
            >
              Delete
            </Button>
          </div>

          {badgeError && <p className="text-dnd text-sm mt-2">{badgeError}</p>}

          {/* Login-info panel: email/role display + the two admin actions
              (role toggle, password reset) that operate on the UserBadge */}
          {showBadge && badgeInfo && (
            <div className="mt-3 p-3 bg-inset border border-line rounded-md space-y-3">
              <div className="text-sm text-ink space-y-0.5">
                <p><span className="text-ink-muted">Email:</span> {badgeInfo.email}</p>
                <p><span className="text-ink-muted">Access Level:</span> {badgeInfo.role}</p>
              </div>

              <div>
                <Button
                  onClick={handleRoleToggle}
                  disabled={roleUpdating}
                  variant="primary" size="md"
                >
                  {roleUpdating
                    ? 'Updating...'
                    : badgeInfo.role === 'admin'
                    ? 'Demote to Member'
                    : 'Promote to Admin'}
                </Button>
                {roleMsg && <p className="text-dnd text-sm mt-1">{roleMsg}</p>}
              </div>

              <form onSubmit={handlePasswordReset} className="space-y-2">
                <label className="block text-sm text-ink-muted">Reset Password</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    className={inputClass}
                    placeholder="New password (min 8 characters)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="secondary" size="md" className="whitespace-nowrap"
                  >
                    Reset
                  </Button>
                </div>
                {/* Green on success, red on any validation/server error - same
                    element re-used for both so the message doesn't jump around */}
                {passwordMsg && (
                  <p className={`text-sm ${passwordError ? 'text-dnd' : 'text-ok'}`}>
                    {passwordMsg}
                  </p>
                )}
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeamMemberCard;