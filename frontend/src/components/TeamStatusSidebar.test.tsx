import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TeamProvider } from '../context/TeamContext';
import { AuthContext } from '../context/useAuth';
import type { AuthContextType, TeamMember } from '../types';
import TeamStatusSidebar from './TeamStatusSidebar';

// The 8/2 bug, pinned.
//
// setStatus updates the UI immediately and then awaits the PATCH, rolling back
// if it fails. The rollback used to write `status: undefined` into the member
// object, and nothing in a 139-test pure-function suite could see it, because
// the bug lives in the seam between React state and the network rather than in
// any function.
//
// This is the one test in the set that mounts the REAL TeamProvider instead of
// a fake context - a fake setStatus has no rollback in it to test. The price is
// that the network has to be faked instead, which is why this file stubs fetch
// where the others just pass values in.

// A stand-in for the parts of Response that TeamContext actually touches.
const jsonResponse = (body: unknown) =>
  ({ ok: true, json: async () => body }) as unknown as Response;

// A refusal. Note it RESOLVES - that's the whole point of the second test:
// fetch only throws when the request itself fails, so a server saying "no"
// arrives looking exactly like a success unless res.ok is checked.
const refusedResponse = (status: number) =>
  ({ ok: false, status, json: async () => ({ message: 'Not allowed' }) }) as unknown as Response;

describe('status writes through the real TeamProvider', () => {
  const member: TeamMember = {
    _id: 'self',
    name: 'Ada Lovelace',
    timezone: 'America/Chicago',
    role: 'Engineer',
    status: 'dnd',
    lastUpdated: '2026-06-15T00:00:00.000Z',
    // A heartbeat from just now. Without it the sidebar derives 'offline' over
    // whatever is stored and the pill stops reflecting the write at all - the
    // schedule layers would be under test instead of the rollback.
    lastSeenAt: new Date().toISOString(),
  };

  const auth: AuthContextType = {
    role: 'member',
    teamMemberId: 'self',
    isAuthenticated: true,
    loading: false,
    login: async () => ({ success: true }),
    logout: async () => {},
  };

  // Held open so the test decides WHEN the write fails. Letting fetch reject
  // straight away would settle the whole thing inside the click, leaving no
  // moment at which the optimistic value is observable - and "it ends up
  // right" is only half of what optimistic means.
  let failTheWrite: (reason: Error) => void;
  // The other half of the same idea: settle the PATCH with a RESPONSE instead
  // of an error, so a REFUSAL (403/500 - resolved, ok:false) can be told apart
  // from a request that never landed at all.
  let answerTheWrite: (res: Response) => void;

  beforeEach(() => {
    // setStatus logs the failure it's recovering from. Expected noise, so it's
    // silenced rather than left to look like a broken test.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const patchInFlight = new Promise<Response>((resolve, reject) => {
      answerTheWrite = resolve;
      failTheWrite = reject;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'PATCH') return patchInFlight;

        const url = String(input);
        // The member list is the only response with anything in it - no
        // recurring shifts, so the schedule reads as "hours not set" and the
        // stored status passes through to the pill untouched.
        if (url.includes('/api/team-members')) return Promise.resolve(jsonResponse([member]));
        return Promise.resolve(jsonResponse([]));
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const renderSidebar = () =>
    render(
      <MemoryRouter>
        <AuthContext.Provider value={auth}>
          <TeamProvider>
            <TeamStatusSidebar />
          </TeamProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    );

  it('shows the new status immediately and puts the old one back when the write fails', async () => {
    const user = userEvent.setup();
    renderSidebar();

    // Waits out the provider's opening fetch AND doubles as the starting
    // assertion. 'dnd' is the status to start from because its pill ("Do Not
    // Disturb") and its picker button ("DND") read differently - 'active'
    // labels both, so counting matches is how those two get told apart below.
    // (The member's NAME is not usable as the anchor here: the sidebar prints
    // it twice, once in the identity block and once on the roster card.)
    expect(await screen.findByText('Do Not Disturb')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Active' }));

    // Optimistic: the PATCH has not resolved and the pill has already moved.
    // Two matches = the pill and the picker button now say the same thing.
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.queryByText('Do Not Disturb')).toBeNull();

    await act(async () => {
      failTheWrite(new Error('network is down'));
    });

    // Rolled back to what was actually stored - and specifically to 'dnd',
    // not to undefined, which is the shape the original bug took.
    expect(screen.getByText('Do Not Disturb')).toBeInTheDocument();
    expect(screen.getAllByText('Active')).toHaveLength(1);
  });

  // The 8/17 bug, pinned. Same optimistic path, different failure: the server
  // ANSWERS and says no. Before the fix only a thrown fetch rolled back, so
  // the refused value stayed on screen until a poll ~15 seconds later replaced
  // it - the user's click appeared to stick, then silently un-stuck.
  it('puts the old status back when the server refuses the write', async () => {
    const user = userEvent.setup();
    renderSidebar();

    expect(await screen.findByText('Do Not Disturb')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Active' }));

    expect(screen.getAllByText('Active')).toHaveLength(2);

    await act(async () => {
      answerTheWrite(refusedResponse(403));
    });

    expect(screen.getByText('Do Not Disturb')).toBeInTheDocument();
    expect(screen.getAllByText('Active')).toHaveLength(1);
  });
});
