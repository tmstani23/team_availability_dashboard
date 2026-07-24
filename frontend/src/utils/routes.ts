// Where a given role's "home" is. Admins must land on /admin/schedule, not
// /dashboard: only AdminLayout renders the Schedule/Manage tabs, so dropping
// an admin on /dashboard strands them with no way to reach the team overview
// or add-member tools. Shared by LoginRoute's post-login redirect and any
// "back to where I came from" link, so the two can't drift apart.
export function homePathForRole(role: 'admin' | 'member' | null): string {
  return role === 'admin' ? '/admin/schedule' : '/dashboard';
}
