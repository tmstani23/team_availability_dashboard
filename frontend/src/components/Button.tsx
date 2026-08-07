import type { ButtonHTMLAttributes, ReactNode } from 'react';

// The one place a button is styled. Before this, every call site restated the
// full class string, and they had drifted: LoginForm and AddTeamMemberForm had
// active: states, HoursEditor and TeamMemberCard didn't; some had
// disabled:opacity-50 and some didn't; padding came in three sizes with no
// pattern behind which went where.
//
// Same argument as STATUS_META and scheduleTime.ts - when a rule is restated
// per call site, the call sites are what drift. Putting it here means a change
// to how a button looks is one edit, and a NEW button can't invent a fourth
// size by accident.
//
// COLOUR RULE: every variant here is brand, neutral or red - never a schedule
// colour. Violet means "you can act on this" and is reserved for that. The
// grid's sage / rose / amber mean what's on the calendar and never appear on
// a control. Ignoring that is how the overlap row and the primary button ended
// up rendering the exact same hex.

type Variant = 'primary' | 'secondary' | 'danger' | 'outline';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  // Escape hatch for LAYOUT only (w-full, self-start, mt-6). Resist passing
  // colours through here - that's how the per-call-site drift started.
  className?: string;
  children: ReactNode;
}

// Two sizes, not three. `sm` is for controls sitting inside a card or a dense
// row; `md` is for a form's own submit. The old py-3 full-width submit is
// covered by md plus a w-full from the caller.
const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

// `outline` is the tinted-border style MeetingPanel already used for its
// booking controls - kept as a real variant rather than normalised away,
// because a panel with a filled primary button in it competes with the
// page's actual primary action.
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-hover active:bg-brand-active',
  secondary:
    'bg-line text-ink hover:bg-line-strong active:bg-line',
  // QUIET BY DEFAULT. This used to be a solid red fill, which put six of the
  // loudest things on screen onto a Manage page that is otherwise entirely
  // read-only information - the eye went to "Delete" before it went to any
  // member's name. A destructive action needs to be findable and unambiguous,
  // not the visual centre of the page.
  //
  // Colour still carries the warning; only the WEIGHT drops. If a confirm step
  // is ever added, that's where the solid fill belongs - loud at the moment of
  // consequence rather than loud at rest.
  danger:
    'bg-transparent text-dnd border border-dnd/35 hover:bg-dnd/10 hover:border-dnd/60',
  outline:
    'bg-brand/15 text-brand-hover border border-brand hover:bg-brand/25',
};

/**
 * The class string on its own, for the cases that must render something other
 * than a <button> but should look identical - a react-router <Link> styled as
 * a button, mainly. Without this those call sites go back to hand-copying the
 * classes, which is the drift this file exists to stop.
 */
export function buttonClasses(
  variant: Variant = 'secondary',
  size: Size = 'sm',
  className = ''
): string {
  return `inline-block rounded-md font-medium transition-colors cursor-pointer
    disabled:opacity-50 disabled:cursor-not-allowed
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-hover/60
    ${SIZES[size]} ${VARIANTS[variant]} ${className}`;
}

const Button = ({
  variant = 'secondary',
  size = 'sm',
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) => (
  <button
    // Defaulting to type="button" matters: an unmarked <button> inside a form
    // submits it. Callers that want a submit pass type="submit" explicitly.
    type={type}
    // focus-visible rather than focus, so a mouse click doesn't leave a ring
    // behind. A visible focus ring is the accessibility floor here - the old
    // inputs used focus:outline-none with only a 1px border colour change,
    // which is close to invisible when tabbing through.
    className={buttonClasses(variant, size, className)}
    {...rest}
  >
    {children}
  </button>
);

export default Button;
