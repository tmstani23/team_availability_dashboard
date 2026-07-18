import type { TeamMemberStatus } from '../types';

// UI metadata for each presence state: the label text and the Tailwind
// classes for its pill. Kept in one place so the sidebar and the admin card
// render identical colors/labels instead of each hard-coding their own copy
// (same DRY reasoning as scheduleTime.ts).
// label = full text for the status pill; short = compact form for the small
// picker buttons where "Do Not Disturb" would wrap.
export const STATUS_META: Record<TeamMemberStatus, { label: string; short: string; pill: string }> = {
  active:  { label: 'Active',         short: 'Active',  pill: 'bg-green-500/15 text-green-400 border-green-500' },
  away:    { label: 'Away',           short: 'Away',    pill: 'bg-yellow-500/15 text-yellow-400 border-yellow-500' },
  dnd:     { label: 'Do Not Disturb', short: 'DND',     pill: 'bg-red-500/15 text-red-400 border-red-500' },
  offline: { label: 'Offline',        short: 'Offline', pill: 'bg-zinc-500/15 text-zinc-400 border-zinc-500' },
};

// The states a user can pick by hand, in the order the picker shows them.
// 'offline' is omitted on purpose - it's schedule-derived, not manually
// settable, mirroring the backend's SETTABLE_STATUSES guard on /status.
export const SETTABLE_STATUSES: TeamMemberStatus[] = ['active', 'away', 'dnd'];
