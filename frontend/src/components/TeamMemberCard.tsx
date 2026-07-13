import { useState } from 'react';
import type { TeamMember } from '../types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useTeam } from '../context/TeamContext';

dayjs.extend(utc);
dayjs.extend(timezone);

interface TeamMemberCardProps {
  member: TeamMember;
}

// Shared input styling so edit mode + the password field match
// AddTeamMemberForm's look instead of drifting apart over time
const inputClass =
  'w-full bg-zinc-800 text-white border border-zinc-700 rounded px-3 py-1.5 text-sm transition-colors focus:outline-none focus:border-violet-500 hover:border-zinc-600';

const TeamMemberCard = ({ member }: TeamMemberCardProps) => {
  const { toggleAvailability, deleteMember, refreshAllData } = useTeam();

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

  const handleToggle = () => {
    toggleAvailability(member._id, member.isAvailable);
  };

  const handleSaveEdit = async () => {
    setEditError('');

    if (!editData.name || !editData.timezone || !editData.role) {
      setEditError('All fields are required');
      return;
    }

    try {
      await fetch(`http://localhost:5000/api/team-members/${member._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // sends the httpOnly cookie so authenticate + requireAdmin can verify this request
        body: JSON.stringify(editData)
      });
      setIsEditing(false);
      await refreshAllData(); // pulls fresh data rather than patching local state manually
    } catch (err) {
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
      const res = await fetch(`http://localhost:5000/api/team-members/${member._id}/badge`, {
        credentials: 'include'
      });

      if (!res.ok) throw new Error('Failed to fetch login info');

      const data = await res.json();
      setBadgeInfo(data);
      setShowBadge(true);
    } catch (err) {
      setBadgeError('Failed to load login info');
    }
  };

  const handleRoleToggle = async () => {
    if (!badgeInfo) return; // panel can't be open without this, but guards against a stray call

    const newRole = badgeInfo.role === 'admin' ? 'member' : 'admin';
    setRoleMsg('');
    setRoleUpdating(true); // disables the button below so a slow request can't be double-clicked

    try {
      const res = await fetch(`http://localhost:5000/api/team-members/${member._id}/role`, {
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
      const res = await fetch(`http://localhost:5000/api/team-members/${member._id}/password`, {
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
    <div className="bg-zinc-800 border border-zinc-700/60 rounded-xl p-4 shadow-lg">
      {isEditing ? (
        // Edit mode - profile fields only (name/timezone/job role), not
        // login credentials - those live in the badge panel below instead
        <div className="space-y-3">
          <h4 className="text-lg font-semibold text-white">Editing {member.name}</h4>
          {editError && <p className="text-red-400 text-sm">{editError}</p>}

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Name</label>
            <input
              className={inputClass}
              value={editData.name}
              onChange={e => setEditData({ ...editData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Timezone</label>
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
            <label className="block text-sm text-zinc-400 mb-1">Job Role</label>
            <input
              className={inputClass}
              value={editData.role}
              onChange={e => setEditData({ ...editData, role: e.target.value })}
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSaveEdit}
              className="px-3 py-1.5 rounded text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors"
            >
              Save Changes
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 rounded text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h3 className="text-lg font-semibold text-white">{member.name}</h3>
          <div className="text-sm text-zinc-300 space-y-0.5 mt-1">
            {/* "Job Role" (member.role, e.g. "Engineer") is a different field
                from "Access Level" (badgeInfo.role, admin/member) below -
                same word, two unrelated concepts, labeled distinctly to avoid confusion */}
            <p><span className="text-zinc-400">Job Role:</span> {member.role}</p>
            <p><span className="text-zinc-400">Timezone:</span> {member.timezone}</p>
            <p>
              <span className="text-zinc-400">Status:</span>{' '}
              <span className={member.isAvailable ? 'text-green-400' : 'text-red-400'}>
                {member.isAvailable ? 'Available' : 'Not Available'}
              </span>
            </p>
            <p><span className="text-zinc-400">Current Local Time:</span> {dayjs().tz(member.timezone).format('hh:mm A')}</p>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={handleToggle}
              className="px-3 py-1.5 rounded text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
            >
              Toggle Availability
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 rounded text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
            >
              Edit
            </button>
            <button
              onClick={handleViewBadge}
              className="px-3 py-1.5 rounded text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
            >
              {showBadge ? 'Hide Login Info' : 'View Login Info'}
            </button>
            {/* Centralized delete confirmation logic lives in TeamContext */}
            <button
              onClick={() => deleteMember(member._id)}
              className="px-3 py-1.5 rounded text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              Delete
            </button>
          </div>

          {badgeError && <p className="text-red-400 text-sm mt-2">{badgeError}</p>}

          {/* Login-info panel: email/role display + the two admin actions
              (role toggle, password reset) that operate on the UserBadge */}
          {showBadge && badgeInfo && (
            <div className="mt-3 p-3 bg-zinc-900 border border-zinc-700 rounded-lg space-y-3">
              <div className="text-sm text-zinc-300 space-y-0.5">
                <p><span className="text-zinc-400">Email:</span> {badgeInfo.email}</p>
                <p><span className="text-zinc-400">Access Level:</span> {badgeInfo.role}</p>
              </div>

              <div>
                <button
                  onClick={handleRoleToggle}
                  disabled={roleUpdating}
                  className="px-3 py-1.5 rounded text-sm font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                >
                  {roleUpdating
                    ? 'Updating...'
                    : badgeInfo.role === 'admin'
                    ? 'Demote to Member'
                    : 'Promote to Admin'}
                </button>
                {roleMsg && <p className="text-red-400 text-sm mt-1">{roleMsg}</p>}
              </div>

              <form onSubmit={handlePasswordReset} className="space-y-2">
                <label className="block text-sm text-zinc-400">Reset Password</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    className={inputClass}
                    placeholder="New password (min 8 characters)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-white transition-colors whitespace-nowrap"
                  >
                    Reset
                  </button>
                </div>
                {/* Green on success, red on any validation/server error - same
                    element re-used for both so the message doesn't jump around */}
                {passwordMsg && (
                  <p className={`text-sm ${passwordError ? 'text-red-400' : 'text-green-400'}`}>
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