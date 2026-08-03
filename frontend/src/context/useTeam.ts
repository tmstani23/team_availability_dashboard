import { createContext, useContext } from 'react';
import type { TeamContextType } from '../types';

// Context object + hook, split out from TeamProvider so the provider module
// exports only components and Fast Refresh can hot-reload it. Same reasoning
// as useAuth.ts - see the longer note there.
export const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (!context) throw new Error('useTeam must be used within a TeamProvider');
  return context;
};
