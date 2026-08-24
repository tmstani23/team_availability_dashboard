import type { ReactElement, ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { AuthContext } from '../context/useAuth';
import { TeamContext } from '../context/useTeam';
import type {
  AuthContextType,
  DayOfWeek,
  RecurringShift,
  TeamContextType,
  TeamMember,
} from '../types';

dayjs.extend(utc);
dayjs.extend(timezone);

// The one piece of shared setup the component tests need. Every component
// worth testing here reads useTeam() and/or useAuth(), and both hooks throw
// outside their provider - so a bare render() of any of them fails before it
// draws anything.
//
// It injects a FAKE context object rather than mounting the real providers.
// That's the point: a fake value is how a test says "the viewer is in Chicago
// and previewing Tokyo" in one line, where the real TeamProvider would have to
// be driven there through the browser's timezone and a network fetch. The
// trade is that it bypasses TeamProvider's own logic entirely - the timezone
// FALLBACK CHAIN and the optimistic-write machinery are invisible from here,
// so anything testing those has to mount the real provider instead (see
// TeamStatusSidebar.test.tsx, which does exactly that).

// One fixed instant for every test that needs "now", so a test can't pass in
// June and fail in December. Chosen inside US daylight saving on purpose:
// Chicago is UTC-5 here, which makes Chicago -> Tokyo a clean +14 and the
// expected values below checkable by hand.
export const FIXED_NOW = dayjs('2026-06-15T18:00:00.000Z');

// Sensible neutral defaults. Anything a test actually cares about it passes in
// explicitly, so reading a test tells you which values it depends on.
const defaultTeam: TeamContextType = {
  now: FIXED_NOW,
  members: [],
  recurringShifts: [],
  meetings: [],
  loading: false,
  setStatus: async () => {},
  setTimezone: async () => ({ success: true }),
  createMeeting: async () => ({ success: true }),
  deleteMeeting: async () => ({ success: true }),
  deleteMember: async () => ({ success: true }),
  refreshAllData: async () => {},
  handleMemberAdded: () => {},
  viewerTimezone: 'America/Chicago',
  displayTimezone: 'America/Chicago',
  previewTimezone: null,
  setPreviewTimezone: () => {},
  browserTimezone: 'America/Chicago',
};

const defaultAuth: AuthContextType = {
  role: 'member',
  teamMemberId: null,
  isAuthenticated: true,
  loading: false,
  login: async () => ({ success: true }),
  logout: async () => {},
};

interface ProviderOptions {
  team?: Partial<TeamContextType>;
  auth?: Partial<AuthContextType>;
}

export function renderWithProviders(
  ui: ReactElement,
  { team, auth }: ProviderOptions = {}
): RenderResult {
  const teamValue: TeamContextType = { ...defaultTeam, ...team };
  const authValue: AuthContextType = { ...defaultAuth, ...auth };

  return render(ui, {
    // MemoryRouter is here for everyone even though only the sidebar uses
    // <Link> - a router that nothing navigates costs nothing, and leaving it
    // out means a component that grows its first link fails with a confusing
    // "useHref() may be used only in the context of a Router" instead.
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <TeamContext.Provider value={teamValue}>{children}</TeamContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    ),
  });
}

/** A team member with everything filled in, so a test only states what differs. */
export function makeMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    _id: 'm1',
    name: 'Ada Lovelace',
    timezone: 'America/Chicago',
    role: 'Engineer',
    status: 'active',
    lastUpdated: '2026-06-15T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * The same standing hours on all seven weekdays.
 *
 * Deliberately a whole week rather than one record. getCurrentShiftForMember
 * picks the record matching the MEMBER's current weekday, so a single Monday
 * shift makes the test's result depend on which day it runs - a suite that
 * passes today and returns an empty grid on Saturday. Covering every day
 * removes the weekday from the question entirely, leaving the test measuring
 * only the thing it's about.
 */
export function makeWeek(
  teamMemberId: string,
  startTime: string,
  endTime: string
): RecurringShift[] {
  return [0, 1, 2, 3, 4, 5, 6].map(day => ({
    teamMemberId,
    dayOfWeek: day as DayOfWeek,
    startTime,
    endTime,
    isOff: false,
  }));
}
