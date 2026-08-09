import type { ReactNode } from 'react';

// The one styled <select> in the app. Everything that drops a list goes
// through here: the two halves of TimeSelect, MeetingPanel's date and
// duration, and the timezone preview.
//
// TWO THINGS IT OWNS, and neither can live in a class string alone:
//
// 1. The chevron. The field sets `appearance: none` (see .select-themed in
//    index.css) to drop the OS arrow, which means something has to draw one.
//    It's an overlay rather than a background-image so it can use a real icon
//    glyph and inherit colour on hover.
// 2. The base-select handoff. On Chromium 135+ the popup becomes styleable and
//    renders its own ::picker-icon, so the overlay below is hidden by the
//    @supports block and the native one is styled instead. Everywhere else the
//    overlay stays and the popup remains the browser's.
//
// The wrapper is inline-flex rather than block so these still sit inline in
// HoursEditor's rows without every call site adding layout classes.

interface ThemedSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  // Accessible name. These sit in dense grids of near-identical controls, so
  // the visible value alone tells a screen reader nothing about which field
  // it is.
  label: string;
  // Width utility, since a select can't size to its content the way an input
  // can - an hour list and a duration list want different widths.
  className?: string;
  children: ReactNode;
}

const ThemedSelect = ({
  value,
  onChange,
  disabled,
  label,
  className = '',
  children,
}: ThemedSelectProps) => (
  <span className={`relative inline-flex items-center ${disabled ? 'opacity-40' : ''}`}>
    <select
      className={`select-themed w-full bg-card text-white border border-line-strong rounded-md
        pl-2.5 pr-7 py-1.5 text-sm tnum cursor-pointer transition-colors
        hover:border-brand/60 disabled:cursor-not-allowed
        focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-hover/60
        ${className}`}
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      aria-label={label}
    >
      {children}
    </select>
    {/* pointer-events-none so the overlay never swallows a click meant for the
        select underneath it. */}
    <span
      aria-hidden="true"
      className="select-themed-chevron pointer-events-none absolute right-2 text-ink-faint text-[10px] leading-none"
    >
      ▾
    </span>
  </span>
);

export default ThemedSelect;
