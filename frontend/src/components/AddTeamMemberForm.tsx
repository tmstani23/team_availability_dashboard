import { useState } from 'react';
import { useTeam } from '../context/useTeam';
import { API_BASE } from '../config';
import Button from './Button';
import { inputClasses } from '../utils/ui';

const AddTeamMemberForm = () => {
  // Single state object for all fields (controlled inputs) rather than
  // separate useState calls per field — keeps setFormData calls simple below
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    timezone: '',
    role: ''
  });

  const [error, setError] = useState('');

  // handleMemberAdded triggers a refetch in TeamContext so the new member
  // shows up in the grid/sidebar/list without a full page reload
  const { handleMemberAdded } = useTeam();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation runs before any network call — cheap checks first
    if (!formData.name || !formData.email || !formData.password || !formData.timezone || !formData.role) {
      setError('All fields are required');
      return;
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      // Backend creates the TeamMember AND its login (UserBadge) in one call.
      // No standing hours are created here - the member starts with zero
      // RecurringShift records and fills their own week later via
      // /profile/hours (see HoursEditor.tsx).
      const response = await fetch(`${API_BASE}/api/team-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        // Backend always sends a specific { message } on failure (e.g.
        // "Email already registered", "Error creating member") - surface
        // that instead of a generic string so the real cause is visible
        // without needing to open the Network tab every time
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Failed to add member');
      }

      // Pull fresh data from the server rather than manually updating local
      // state — keeps this component dumb and avoids state drift
      handleMemberAdded();

      // Reset the form back to its initial empty shape after a successful add
      setFormData({ name: '', email: '', password: '', timezone: '', role: '' });
      setError('');
    } catch (err) {
      // Logged for dev visibility in the console, in addition to being
      // shown in the UI via setError below
      console.error('Add member failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to add member. Please try again.');
    }
  };

  return (
    <div className="bg-card border border-line p-6 rounded-xl shadow-xl max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Add New Team Member</h3>

        {error && <p className="text-dnd text-sm">{error}</p>}

        <div>
          <label className="block text-sm text-ink-muted mb-1">Name</label>
          <input
            className={inputClasses("md", "w-full")}
            placeholder="e.g. Jane Smith"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-ink-muted mb-1">Email</label>
          <input
            className={inputClasses("md", "w-full")}
            type="email"
            placeholder="jane@company.com"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-ink-muted mb-1">Password</label>
          <input
            className={inputClasses("md", "w-full")}
            type="password"
            placeholder="Set an initial password"
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm text-ink-muted mb-1">Timezone</label>
          {/* Fixed list rather than free text to keep values as valid IANA timezone strings */}
          <select
            className={inputClasses("md", "w-full")}
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
          <label className="block text-sm text-ink-muted mb-1">Role</label>
          <input
            className={inputClasses("md", "w-full")}
            placeholder="e.g. Engineer"
            value={formData.role}
            onChange={e => setFormData({ ...formData, role: e.target.value })}
            required
          />
        </div>

        <Button type="submit" variant="primary" size="md" className="w-full">
          Add Member
        </Button>
      </form>
    </div>
  );
};

export default AddTeamMemberForm;