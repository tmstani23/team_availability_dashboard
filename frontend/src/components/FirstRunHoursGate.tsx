import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTeam } from '../context/TeamContext';
import { shiftMemberId } from '../utils/scheduleTime';

// Dismissible, non-blocking nudge shown when the logged-in member has zero
// RecurringShift records at all - the "never set up" state, distinct from an
// explicit day-off record (see ShiftResolution in scheduleTime.ts). Mounted
// once in ProtectedLayout (App.tsx) so it floats over both /dashboard and
// /admin/* without being tied to either page's own layout.
// Dismissal is in-memory only (component state, not persisted anywhere), so
// it reappears on the next login/reload by design - nextSteps.md calls this
// "non-blocking," not "seen it once, gone forever."
const FirstRunHoursGate = () => {
  const { teamMemberId, loading: authLoading } = useAuth();
  const { recurringShifts, loading: teamLoading } = useTeam();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(false);

  // Wait for both auth and team data before deciding anything - otherwise
  // this would flash open on every load while recurringShifts is still [].
  if (authLoading || teamLoading || dismissed || !teamMemberId) return null;

  // Pointless (and in the way) on the page it's telling you to go to.
  if (pathname.startsWith('/profile/hours')) return null;

  const hasAnyHours = recurringShifts.some(s => shiftMemberId(s) === teamMemberId);
  if (hasAnyHours) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-zinc-800 border border-amber-500/60 rounded-xl shadow-xl p-4">
      <h4 className="text-white font-semibold text-sm mb-1">Set your weekly hours</h4>
      <p className="text-zinc-400 text-xs mb-3">
        You haven't set up your standing hours yet - the schedule grid won't
        know when you're working until you do.
      </p>
      <div className="flex gap-2">
        <Link
          to="/profile/hours"
          onClick={() => setDismissed(true)}
          className="px-3 py-1.5 rounded text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors"
        >
          Set my hours
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="px-3 py-1.5 rounded text-xs font-medium bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  );
};

export default FirstRunHoursGate;
