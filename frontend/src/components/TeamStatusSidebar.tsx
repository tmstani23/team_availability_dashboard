import { useTeam } from '../context/TeamContext';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TeamStatusSidebar = () => {
  // Consuming global state and actions from TeamContext
  const { members, toggleAvailability, viewerId, setViewer, viewerTimezone } = useTeam();


  const getLocalTime = (tz: string) => {
    try {
      return dayjs().tz(tz).format('hh:mm A');
    } catch {
      return dayjs().format('hh:mm A');
    }
  };

  return (
    <div style={{
      width: '280px', position: 'fixed', top: 0, right: 0, height: '100vh',
      backgroundColor: '#1a1d20', borderLeft: '1px solid #343a40', color: '#fff',
      padding: '1.5rem', boxSizing: 'border-box', overflowY: 'auto', zIndex: 1000
    }}>
      <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid #343a40', paddingBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>
          Simulating Active User:
        </label>
        <select
          value={viewerId || ''}
          onChange={(e) => setViewer(e.target.value)}
          style={{ width: '100%', padding: '0.4rem', backgroundColor: '#2b3035', color: '#fff', border: '1px solid #495057', borderRadius: '4px' }}
        >
          {members.map((m: any) => (
            <option key={m._id} value={m._id}>{m.name}</option>
          ))}
        </select>
        <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.4rem' }}>
          Your local time: {getLocalTime(viewerTimezone)}
        </div>
      </div>

      <h3 style={{ marginTop: 0, marginBottom: '1.2rem', fontSize: '1.1rem' }}>Live Availability</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {members.map((member: any) => {
          const isSelf = member._id === viewerId;
          return (
            <div key={member._id} style={{ backgroundColor: '#212529', padding: '0.8rem', borderRadius: '6px', border: isSelf ? '1px solid #0d6efd' : '1px solid #2b3035' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                    {member.name} {isSelf && <span style={{ color: '#0d6efd', fontSize: '0.8rem' }}>(You)</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#aaa' }}>{member.role}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>🕒 {getLocalTime(member.timezone)}</div>
                </div>
                <span style={{
                  fontSize: '0.75rem', padding: '3px 8px', borderRadius: '12px', fontWeight: '500',
                  backgroundColor: member.isAvailable ? 'rgba(40, 167, 69, 0.15)' : 'rgba(220, 53, 69, 0.15)',
                  color: member.isAvailable ? '#28a745' : '#dc3545', border: `1px solid ${member.isAvailable ? '#28a745' : '#dc3545'}`
                }}>
                  {member.isAvailable ? 'Available' : 'Away'}
                </span>
              </div>

              {isSelf && (
                <button
                  onClick={() => toggleAvailability(member._id, member.isAvailable)}
                  style={{ width: '100%', marginTop: '0.6rem', padding: '4px', backgroundColor: member.isAvailable ? '#dc3545' : '#28a745', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Set as {member.isAvailable ? '🔴 Away' : '🟢 Available'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TeamStatusSidebar;
