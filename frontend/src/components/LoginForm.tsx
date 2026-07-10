import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

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
    <div className="min-h-screen bg-[#0f1112] flex items-center justify-center">
      <div className="bg-zinc-800 border border-zinc-700/60 p-8 rounded-xl shadow-xl max-w-sm w-full mx-4">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">Team Availability Dashboard</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Email</label>
            <input
              type="email"
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 transition-colors focus:outline-none focus:border-violet-500 hover:border-zinc-600"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Password</label>
            <input
              type="password"
              className="w-full bg-zinc-800 text-white border border-zinc-700 rounded px-4 py-2 transition-colors focus:outline-none focus:border-violet-500 hover:border-zinc-600"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-all duration-200 shadow-lg shadow-violet-500/10 cursor-pointer"
          >
            {submitting ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;