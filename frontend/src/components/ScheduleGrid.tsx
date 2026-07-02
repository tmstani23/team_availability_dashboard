import type { TeamMember } from '../types';

interface Props {
    members: TeamMember[];
    shifts: any[];
}

const ScheduleGrid = ({ members, shifts }: Props) => {
    // Hours from 8:00 to 20:00
    const hours = Array.from({ length: 13 }, (_, i) => i + 8);

    return (
        <div>
            {/* Wrap everything in ONE single scroll container so header and rows scroll together */}
            <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
                <h2 style={{ padding: '8px 16px', margin: 0 }}>Daily Schedule Matrix</h2>
                {/* 
                Define structural variables to keep both grids perfectly identical.
                Changing these numbers updates the entire layout uniformly.
                */}
                {(() => {
                    const totalColumns = hours.length + 1;
                    const columnWidth = '60px'; // Made both grids match at 60px
                    const gridGap = '2px';       // Made both gaps match at 2px
                    const calculatedMinWidth = `calc(120px + (${hours.length} * ${columnWidth}) + (${totalColumns - 1} * ${gridGap}))`; // 120px gives the name column extra breathing room
                    const gridTemplate = `120px repeat(${hours.length}, ${columnWidth})`; // Explicit width for name column, uniform width for hours

                    return (
                        <div style={{ minWidth: calculatedMinWidth, padding: '16px' }}>

                            {/* Scrollable header */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: gridTemplate,
                                gap: gridGap,
                                marginBottom: '12px',
                                paddingBottom: '8px'
                            }}>
                                {/* Empty placeholder column matching the 120px name column */}
                                <div></div>

                                {hours.map(hour => (
                                    <div key={hour} style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.75em', whiteSpace: 'nowrap' }}>
                                        {hour}:00
                                    </div>
                                ))}
                            </div>

                            {/* Team Member Rows */}
                            {members.map(member => {
                                const memberShifts = shifts.filter(s => String(s.teamMemberId) === String(member._id) || String(s.teamMemberId?._id) === String(member._id));

                                return (
                                    <div key={member._id} style={{
                                        display: 'grid',
                                        gridTemplateColumns: gridTemplate, // Perfect alignment link
                                        gap: gridGap,
                                        margin: '6px 0',
                                        alignItems: 'center'
                                    }}>
                                        {/* Name Column - bounded strictly inside the 120px track */}
                                        <div style={{
                                            fontWeight: 'bold',
                                            paddingRight: '8px',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {member.name}
                                        </div>

                                        {hours.map(hour => {
                                            const shift = memberShifts.find(s => {
                                                const startHour = parseInt(s.startTime.split(':'));
                                                const endHour = parseInt(s.endTime.split(':'));
                                                return hour >= startHour && hour < endHour;
                                            });

                                            const isStartOfShift = shift && hour === parseInt(shift.startTime.split(':'));

                                            return (
                                                <div
                                                    key={hour}
                                                    style={{
                                                        border: '1px solid #ddd',
                                                        height: '40px',
                                                        backgroundColor: shift ? '#4caf50' : '#f5f5f5',
                                                        color: shift ? 'white' : '#666',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.62em', /* Smaller font */
                                                        lineHeight: '1.1',   /* Packs lines closer together */
                                                        position: 'relative',
                                                        borderRadius: '2px',
                                                        padding: '2px 0',    /* Tightens vertical space */
                                                        textAlign: 'center'
                                                    }}
                                                >
                                                    {isStartOfShift && (
                                                        <>
                                                            <div>{shift.startTime}</div>
                                                            <div>{"to"}</div>
                                                            <div>{shift.endTime}</div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export default ScheduleGrid;