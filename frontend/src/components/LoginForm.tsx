import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import Button from './Button';
import { inputClasses } from '../utils/ui';

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await login(email, password);

    if (!result.success) {
      setError(result.message || 'Login failed');
    }
    // On success, AuthContext's role/teamMemberId update, which App.tsx
    // reacts to by swapping this form out for the dashboard - no redirect needed

    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <div className="bg-card border border-line p-8 rounded-xl shadow-xl max-w-sm w-full mx-4">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Team Availability Dashboard</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-dnd text-sm">{error}</p>}

          <div>
            <label className="block text-sm text-ink-muted mb-1">Email</label>
            <input
              type="email"
              className={inputClasses("md", "w-full")}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-ink-muted mb-1">Password</label>
            <input
              type="password"
              className={inputClasses("md", "w-full")}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" variant="primary" size="md" disabled={submitting} className="w-full">
            {submitting ? 'Logging in...' : 'Log In'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;