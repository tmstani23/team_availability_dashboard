import { useState } from 'react';
import { useTeam } from '../context/TeamContext';

const AddTeamMemberForm = () => {
  // Single state object for all fields (controlled inputs) rather than
  // separate useState calls per field — keeps setFormData calls simple below
  const [formData, setFormData] = useState({
    name: '',
    email: '',
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
    if (!formData.name || !formData.email || !formData.timezone || !formData.role || !formData.startTime || !formData.endTime) {
      setError('All fields are required');
      return;
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    // Basic time validation (start before end)
    if (formData.startTime >= formData.endTime) {
      setError('Start time must be before end time');
      return;
    }

    // Convert "HH:mm" to total minutes so we can measure shift duration
    const [startH, startM] = formData.startTime.split(':').map(Number);
    const [endH, endM] = formData.endTime.split(':').map(Number);
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);

    // ScheduleGrid only renders at hour granularity, so anything under an hour
    // won't visibly appear on the grid even though it saves fine to the DB
    if (durationMinutes < 60) {
      setError('Shift must be at least 1 hour long');
      return;
    }

    try {
      // Backend creates the TeamMember AND an initial WorkShift in one call
      // when startTime/endTime are present (see teamMembersRoutes.ts)
      const response = await fetch('http://localhost:5000/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to add member');

      // Pull fresh data from the server rather than manually updating local
      // state — keeps this component dumb and avoids state drift
      handleMemberAdded();

      // Reset the form back to its initial empty shape after a successful add
      setFormData({ name: '', email: '', timezone: '', role: '', startTime: '', endTime: '' });
      setError('');
    } catch (err) {
      setError('Failed to add member. Please try again.');
    }
  };

  return (
    <div className="bg-zinc-900 p-6 rounded-xl shadow-lg max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Add New Team Member</h3>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Name</label>
          <input
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 transition-colors focus:outline-none focus:border-blue-500 hover:border-zinc-600"
            placeholder="e.g. Jane Smith"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Email</label>
          <input
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 transition-colors focus:outline-none focus:border-blue-500 hover:border-zinc-600"
            type="email"
            placeholder="jane@company.com"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Timezone</label>
          {/* Fixed list rather than free text — keeps values as valid IANA
              timezone strings, which dayjs.tz() requires elsewhere in the app */}
          <select
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 transition-colors focus:outline-none focus:border-blue-500 hover:border-zinc-600"
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
            className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 transition-colors focus:outline-none focus:border-blue-500 hover:border-zinc-600"
            placeholder="e.g. Engineer"
            value={formData.role}
            onChange={e => setFormData({ ...formData, role: e.target.value })}
            required
          />
        </div>

        {/* Shift Start/End are grouped side-by-side since they're logically
            paired and rarely need to wrap independently */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Shift Start</label>
            <input
              type="time"
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 transition-colors focus:outline-none focus:border-blue-500 hover:border-zinc-600"
              value={formData.startTime}
              onChange={e => setFormData({ ...formData, startTime: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Shift End</label>
            <input
              type="time"
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 transition-colors focus:outline-none focus:border-blue-500 hover:border-zinc-600"
              value={formData.endTime}
              onChange={e => setFormData({ ...formData, endTime: e.target.value })}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors"
        >
          Add Member
        </button>
      </form>
    </div>
  );
};

export default AddTeamMemberForm;