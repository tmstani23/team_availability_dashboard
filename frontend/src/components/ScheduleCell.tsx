import type { ReactNode } from 'react';

// One hour cell in the schedule grid. Pulled out of ScheduleGrid so the
// carve-out drawing lives in exactly one place: the member rows and the
// overlap row both render through here, and Phase 3's meetings can too.
//
// This component knows nothing about lunches, meetings, or shifts - it takes a
// fraction of itself to draw as "carved out" and paints it. That's deliberate:
// a standing lunch and a booked meeting are the same visual idea (a window
// removed from otherwise-available time), so teaching the grid to draw one
// generic carve-out means the second feature inherits the rendering for free.

// Cell colors. Kept as literals rather than Tailwind classes because the
// carve-out is painted with a gradient built at runtime from a fraction, and
// Tailwind can't generate a class for an arbitrary percentage. These match
// bg-emerald-600 / bg-zinc-800 / bg-violet-600 so cells rendered here sit
// flush with the Tailwind-styled ones around them.
const COLOR_ACTIVE = '#059669';   // emerald-600 - on shift
const COLOR_OVERLAP = '#7c3aed';  // violet-600 - everyone free (overlap row)
const COLOR_IDLE = '#27272a';     // zinc-800 - not working
const COLOR_CARVE = '#3f3f46';    // zinc-700 - carved out of an active block

// Quarter-hour guides, drawn only on cells that actually contain a carve-out.
// A permanent ruler across all 24 columns of every row was the alternative and
// it drowns the grid - this puts the reference exactly where there's something
// to measure against, and nowhere else.
const TICK_COLOR = 'rgba(255,255,255,0.28)';
const TICKS = `repeating-linear-gradient(90deg, transparent 0 25%, ${TICK_COLOR} 25% calc(25% + 1px))`;

interface ScheduleCellProps {
  // Inside the shift block (or, on the overlap row, an hour everyone shares).
  isActive: boolean;
  // The slice of THIS cell to draw as carved out, as fractions from 0 to 1.
  // Null when nothing is carved out of this hour. Comes straight from
  // carveOutFractionInHour - see scheduleTime.ts.
  carve?: { start: number; end: number } | null;
  // Violet treatment for the overlap row, emerald for member rows.
  variant?: 'member' | 'overlap';
  children?: ReactNode;
}

const ScheduleCell = ({ isActive, carve, variant = 'member', children }: ScheduleCellProps) => {
  const activeColor = variant === 'overlap' ? COLOR_OVERLAP : COLOR_ACTIVE;
  const baseColor = isActive ? activeColor : COLOR_IDLE;

  // An inactive cell has nothing to carve out of - a lunch outside the shift
  // is already handled upstream (the API won't store one), but a null-safe
  // path here keeps the component honest on its own terms.
  const showCarve = Boolean(carve && isActive);

  // Hard-stop gradient: active up to the carve, carve colour through it,
  // active again after. Doubling each stop is what makes the transition a
  // clean edge instead of a fade.
  const background = showCarve && carve
    ? `linear-gradient(90deg,
        ${activeColor} 0%,
        ${activeColor} ${carve.start * 100}%,
        ${COLOR_CARVE} ${carve.start * 100}%,
        ${COLOR_CARVE} ${carve.end * 100}%,
        ${activeColor} ${carve.end * 100}%,
        ${activeColor} 100%)`
    : baseColor;

  return (
    <div
      className={`border border-zinc-700 h-10 flex items-center justify-center text-[10px] rounded transition-colors
        ${isActive ? 'text-white font-medium' : 'text-zinc-500'}
      `}
      style={{
        background,
        // Ticks ride on top of the gradient as a second background layer, so
        // the fill underneath stays a single source of truth.
        ...(showCarve ? { backgroundImage: `${TICKS}, ${background}` } : {}),
      }}
    >
      {children}
    </div>
  );
};

export default ScheduleCell;
