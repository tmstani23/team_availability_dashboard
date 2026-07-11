import { useState } from 'react';
import { useTeam } from '../context/TeamContext';
import dayjs from 'dayjs';

const AddTeamMemberForm = () => {
  // Single state object for all fields (controlled inputs) rather than
  // separate useState calls per field — keeps setFormData calls simple below
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    timezone: '',
    role: '',
    startTime: '',
    endTime: ''
  });

  const [error, setError] = useState('');

  // handleMemberAdded triggers a refetch in TeamContext so the new member
  // shows up in the grid/sidebar/list without a full page reload
  const { handleMemberAdded } = useTeam();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation runs before any network call — cheap checks first
    if (!formData.name || !formData.email || !formData.password ||!formData.timezone || !formData.role || !formData.startTime || !formData.endTime) {
      setError('All fields are required');
      return;
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    // Parse times using an arbitrary fallback date string (ISO 8601 template format)
    const start = dayjs(`2026-01-01T${formData.startTime}`);
    const end = dayjs(`2026-01-01T${formData.endTime}`);

    if (!start.isBefore(end)) {
      setError('Start time must be before end time');
      return;
    }
    
    // Ensure shifts only start and end exactly on the hour to match ScheduleGrid granularity
    if (start.minute() !== 0 || end.minute() !== 0) {
      setError('Shifts must start and end exactly on the hour (e.g., 09:00)');
      return;
    }

    // shifts under 60 mins will completely disappear from the visual interface.
    if (end.diff(start, 'minute') < 60) {
      setError('Shift must be at least 1 hour long');
      return;
    }

    try {
      // Backend creates the TeamMember AND an initial WorkShift in one call
      // when startTime/endTime are present (see teamMembersRoutes.ts)
      const response = await fetch('http://localhost:5000/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to add member');

      // Pull fresh data from the server rather than manually updating local
      // state — keeps this component dumb and avoids state drift
      handleMemberAdded();

      // Reset the form back to its initial empty shape after a successful add
      setFormData({ name: '', email: '', password: '', timezone: '', role: '', startTime: '', endTime: '' });
      setError('');
    } catch (err) {
      setError('Failed to add member. Please try again.');
    }
  };

  return (
    <div className="bg-zinc-800 border border-zinc-700/60 p-6 rounded-xl shadow-xl max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Add New Team Member</h3>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Name</label>
          <input
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 transition-colors focus:outline-none focus:border-violet-500 hover:border-zinc-600"
            placeholder="e.g. Jane Smith"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Email</label>
          <input
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 transition-colors focus:outline-none focus:border-violet-500 hover:border-zinc-600"
            type="email"
            placeholder="jane@company.com"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Password</label>
          <input
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 transition-colors focus:outline-none focus:border-violet-500 hover:border-zinc-600"
            type="password"
            placeholder="Set an initial password"
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Timezone</label>
          {/* Fixed list rather than free text to keep values as valid IANA timezone strings */}
          <select
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 transition-colors focus:outline-none focus:border-violet-500 hover:border-zinc-600"
            value={formData.timezone}
            onChange={e => setFormData({ ...formData, timezone: e.target.value })}
            required
          >
            <option value="">Select Timezone</option>
            <option value="America/New_York">America/New_York (Eastern)</option>
            <option value="America/Chicago">America/Chicago (Central)</option>
            <option value="America/Denver">America/Denver (Mountain)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (Pacific)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
            <option value="Europe/Paris">Europe/Paris</option>
            <option value="Asia/Tokyo">Asia/Tokyo</option>
            <option value="Australia/Sydney">Australia/Sydney</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Role</label>
          <input
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 transition-colors focus:outline-none focus:border-violet-500 hover:border-zinc-600"
            placeholder="e.g. Engineer"
            value={formData.role}
            onChange={e => setFormData({ ...formData, role: e.target.value })}
            required
          />
        </div>

        {/* Shift Start/End are grouped side-by-side since they are logically paired */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Shift Start</label>
            <input
              type="time"
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 transition-colors focus:outline-none focus:border-violet-500 hover:border-zinc-600"
              value={formData.startTime}
              onChange={e => setFormData({ ...formData, startTime: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Shift End</label>
            <input
              type="time"
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 transition-colors focus:outline-none focus:border-violet-500 hover:border-zinc-600"
              value={formData.endTime}
              onChange={e => setFormData({ ...formData, endTime: e.target.value })}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-medium py-3 rounded-lg transition-all duration-200 shadow-lg shadow-violet-500/10 cursor-pointer"
        >
          Add Member
        </button>
      </form>
    </div>
  );
};

export default AddTeamMemberForm;