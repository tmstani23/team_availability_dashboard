import TeamMemberList from './TeamMemberList';
import AddTeamMemberForm from './AddTeamMemberForm';

// Admin-only tab: view/edit/delete existing members, and add new ones.
// No sidebar here - unlike ScheduleView, this doesn't need the fixed-width
// layout, so it can just stack in AdminLayout's padded content area.
// space-y-10 puts the gap on the parent rather than baking a margin into
// either child, so both stay reusable on their own elsewhere
const ManageView = () => (
  <div className="p-4 space-y-10">
    <TeamMemberList />
    <AddTeamMemberForm />
  </div>
);

export default ManageView;