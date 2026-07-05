import { useState } from 'react';
import { useTeam } from '../context/TeamContext';

const AddTeamMemberForm = () => {
  // Local state to hold the values typed into the form fields
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    timezone: '', 
    role: '', 
    startTime: '', 
    endTime: '' 
  });

  // State to show validation or submission errors to the user
  const [error, setError] = useState('');

  const { handleMemberAdded } = useTeam();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    // Basic client-side validation before sending to backend
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

    try {
      // Send the new member data to backend to be saved in MongoDB
      const response = await fetch('http://localhost:5000/api/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to add member');

      // Tell parent component to refresh the list
      handleMemberAdded();

      // Clear the form after successful submission
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

        <input 
          className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
          placeholder="Name" 
          value={formData.name}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
          required 
        />
        <input 
          className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
          type="email" 
          placeholder="Email" 
          value={formData.email}
          onChange={e => setFormData({ ...formData, email: e.target.value })}
          required 
        />
        
        {/* Dropdown ensures user picks a valid timezone format */}
        <select 
          className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
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

        <input 
          className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
          placeholder="Role" 
          value={formData.role}
          onChange={e => setFormData({ ...formData, role: e.target.value })}
          required 
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Shift Start</label>
            <input 
              type="time" 
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
              value={formData.startTime} 
              onChange={e => setFormData({ ...formData, startTime: e.target.value })} 
              required 
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Shift End</label>
            <input 
              type="time" 
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
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