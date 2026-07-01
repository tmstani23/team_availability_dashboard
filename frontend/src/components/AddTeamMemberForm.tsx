import { useState } from 'react';

const AddTeamMemberForm = ({ onMemberAdded }: { onMemberAdded: () => void }) => {
  // Local state to hold the values typed into the form fields
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    timezone: '',
    role: ''
  });

  // State to show validation or submission errors to the user
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Clear previous errors

    // Basic client-side validation before sending to backend
    if (!formData.name || !formData.email || !formData.timezone || !formData.role) {
      setError('All fields are required');
      return;
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
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
      onMemberAdded();
      
      // Clear the form after successful submission
      setFormData({ name: '', email: '', timezone: '', role: '' });
      setError('');
    } catch (err) {
      setError('Failed to add member. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h3>Add New Team Member</h3>
      
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <input 
        placeholder="Name" 
        value={formData.name} 
        onChange={e => setFormData({...formData, name: e.target.value})} 
        required 
      />
      <input 
        type="email" 
        placeholder="Email" 
        value={formData.email} 
        onChange={e => setFormData({...formData, email: e.target.value})} 
        required 
      />
      
      {/* Dropdown ensures user picks a valid timezone format */}
      <select 
        value={formData.timezone} 
        onChange={e => setFormData({...formData, timezone: e.target.value})} 
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
        placeholder="Role" 
        value={formData.role} 
        onChange={e => setFormData({...formData, role: e.target.value})} 
        required 
      />
      
      <button type="submit">Add Member</button>
    </form>
  );
};

export default AddTeamMemberForm;