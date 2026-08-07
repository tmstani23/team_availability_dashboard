import type { ReactNode } from 'react';

// One hour cell in the schedule grid. Pulled out of ScheduleGrid so the
// carve-out drawing lives in exactly one place: the member rows and the
// overlap row both render through here, and Phase 3's meetings can too.
//
// This component knows nothing about lunches, meetings, or shifts - it takes
// fractions of itself to draw as "carved out", plus a colour per fraction, and
// paints them. That's deliberate: a standing lunch and a booked meeting are the
// same visual idea (a window removed from otherwise-available time), so one
// generic carve-out renderer serves both.
//
// Phase 3 changed two things here, and both were real changes rather than free
// inherits: the single carve became a LIST (a member can be at lunch and in a
// meeting in the same hour), and carves no longer require an active cell (a
// meeting can be booked outside someone's shift; a lunch never can).

// Cell colors. These are CSS var() references rather than hex literals: the
// carve-out is painted with a gradient built at runtime from a fraction, which
// Tailwind can't generate a class for, but a CSS gradient accepts var() just
// fine. So the tokens in index.css stay the single source and there's no hex
// mirrored into TypeScript to drift out of sync.
const COLOR_ACTIVE = 'var(--color-shift)';    // on shift
const COLOR_OVERLAP = 'var(--color-booked)';  // everyone free (overlap row)
const COLOR_IDLE = 'var(--color-idle)';       // not working
export const COLOR_CARVE = 'var(--color-carve)'; // carved out of an active block
// Meetings get their own carve colour so a booked hour doesn't read as a
// lunch. Rose matches the overlap row and the "In a meeting" pill - the overlap
// row is where meetings get found, so the whole feature stays one colour.
//
// It used to be violet, which collided with the primary button (both were
// literally #7c3aed). Moving it, the constraint that mattered turned out to be
// legibility against the SHIFT colour rather than against the chrome: a meeting is
// drawn INSIDE an on-shift block, so booked-next-to-shift is the pair a reader
// actually has to separate. Warm rose against cool sage separates on hue,
// value and temperature at once.
//
// Exported because the CALLER decides what a slice means; this component still
// doesn't know or care (see the header note).
export const COLOR_MEETING = 'var(--color-booked-strong)';

// Quarter-hour guides, drawn only on cells that actually contain a carve-out.
// A permanent ruler across all 24 columns of every row was the alternative and
// it drowns the grid - this puts the reference exactly where there's something
// to measure against, and nowhere else.
const TICK_COLOR = 'rgba(255,255,255,0.28)';

// Three 1px lines centred on the quarter marks. Written out explicitly rather
// than as a repeating-linear-gradient: the repeating version had a unit of
// `25% + 1px`, so each tick drifted a pixel further right than the last and
// the pattern wrapped far enough to paint a spurious fourth line at the cell's
// edge. Four slightly-off lines read as a rendering glitch rather than a ruler.
const tick = (position: number) =>
  `transparent calc(${position}% - 0.5px), ${TICK_COLOR} calc(${position}% - 0.5px), ` +
  `${TICK_COLOR} calc(${position}% + 0.5px), transparent calc(${position}% + 0.5px)`;
const TICKS = `linear-gradient(90deg, transparent, ${tick(25)}, ${tick(50)}, ${tick(75)}, transparent)`;

// One slice of this cell to paint as carved out, as fractions from 0 to 1
// (0.0-0.5 = the left half). `color` lets the caller say what kind of carve-out
// it is without this component having to know - a lunch and a meeting are the
// same visual idea in different paint.
export interface CellCarve {
  start: number;
  end: number;
  color?: string;
}

interface ScheduleCellProps {
  // Inside the shift block (or, on the overlap row, an hour everyone shares).
  isActive: boolean;
  // Every carve-out touching THIS cell. An array rather than a single value
  // because a member can have a standing lunch and a booked meeting inside the
  // same hour - Phase 2 only ever had one producer, Phase 3 added a second.
  // Comes from carveOutFractionInHour - see scheduleTime.ts.
  //
  // ORDER IS MEANINGFUL: where two slices overlap, the LATER one is drawn on
  // top. That's the only way this component expresses priority, and it keeps
  // it ignorant of what the slices mean - the caller knows a meeting outranks
  // a lunch, so the caller lists lunch first.
  carves?: CellCarve[];
  // Rose treatment for the overlap row, sage for member rows.
  variant?: 'member' | 'overlap';
  children?: ReactNode;
}

const ScheduleCell = ({ isActive, carves, variant = 'member', children }: ScheduleCellProps) => {
  const activeColor = variant === 'overlap' ? COLOR_OVERLAP : COLOR_ACTIVE;
  const baseColor = isActive ? activeColor : COLOR_IDLE;

  // Clamped to the cell and stripped of zero-width entries. Note there is NO
  // sorting and no overlap-trimming - see the layering below for why that
  // turned out to be the wrong instinct.
  const slices = (carves ?? [])
    .map(slice => ({
      ...slice,
      start: Math.max(slice.start, 0),
      end: Math.min(slice.end, 1),
    }))
    .filter(slice => slice.end > slice.start);

  // NOTE the carve no longer requires isActive. A lunch can't fall outside a
  // shift (the API rejects one), but a MEETING can be booked at 9pm on
  // someone's day off - and that's precisely the booking worth seeing. A carve
  // on an idle cell reads as "booked outside their hours", which is true.
  const showCarve = slices.length > 0;

  // ONE GRADIENT LAYER PER SLICE, stacked, rather than one gradient with every
  // slice's stops in it.
  //
  // The single-sweep version had to sort the slices and trim overlaps to keep
  // its stops in ascending order, and that quietly ATE any slice contained
  // inside another: a 12:15-12:45 meeting booked inside a 12:00-13:00 lunch
  // got trimmed to nothing, so the cell drew as pure lunch. The status stack
  // says a meeting outranks a lunch, and the grid was saying the opposite.
  //
  // Layering removes the problem rather than patching it. Each slice paints
  // its own range and is transparent everywhere else, so overlaps resolve by
  // stacking order with no sorting, no trimming, and no lost slices. CSS
  // paints the FIRST background-image layer on top, so the list is reversed:
  // later slices win, and the caller decides priority purely by array order.
  // (ScheduleGrid puts lunch first, meetings after.)
  const layer = (slice: CellCarve) => {
    const from = slice.start * 100;
    const to = slice.end * 100;
    const color = slice.color ?? COLOR_CARVE;
    // Doubling each stop is what makes the edge hard instead of a fade.
    return `linear-gradient(90deg, transparent ${from}%, ${color} ${from}%, ${color} ${to}%, transparent ${to}%)`;
  };

  const carveLayers = [...slices].reverse().map(layer);
  // Ticks ride above every carve so the ruler is never buried under a fill.
  const backgroundImage = showCarve ? [TICKS, ...carveLayers].join(', ') : undefined;

  return (
    <div
      className={`border border-line h-10 flex items-center justify-center text-[10px] rounded-md transition-colors
        ${isActive ? 'text-white font-medium' : 'text-ink-faint'}
      `}
      style={{
        // The solid base sits underneath as a background COLOR, so the
        // transparent regions of every layer above fall through to it. That's
        // what lets each slice describe only its own range.
        backgroundColor: baseColor,
        ...(backgroundImage ? { backgroundImage } : {}),
      }}
    >
      {children}
    </div>
  );
};

export default ScheduleCell;
