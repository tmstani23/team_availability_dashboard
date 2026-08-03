import { createContext, useContext } from 'react';
import type { AuthContextType } from '../types';

// The context object and its hook live here, apart from AuthProvider itself.
//
// Why the split: React Fast Refresh can only hot-reload a module when
// everything it exports is a component. A file exporting BOTH AuthProvider (a
// component) and useAuth (not one) forces a full remount on every edit, which
// in practice means losing your logged-in session mid-development. Splitting
// costs one extra file and buys working hot reload.
//
// Named useAuth.ts rather than authContext.ts on purpose: Windows and macOS
// filesystems are case-insensitive, so a file differing from AuthContext.tsx
// only by capitalisation would collide.
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
