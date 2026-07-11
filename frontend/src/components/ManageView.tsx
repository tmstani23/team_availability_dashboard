import TeamMemberList from './TeamMemberList';
import AddTeamMemberForm from './AddTeamMemberForm';

// Admin-only tab: view/edit/delete existing members, and add new ones.
// No sidebar here - unlike ScheduleView, this doesn't need the fixed-width
// layout, so it can just stack in AdminLayout's padded content area
const ManageView = () => (
  <div className="p-4">
    <TeamMemberList />
    <AddTeamMemberForm />
  </div>
);

export default ManageView;