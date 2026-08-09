// Shared control styling as class strings rather than components. Inputs come
// as <input>, <select> and <textarea> with different props and different
// children rules, so a wrapper component would be more ceremony than the
// duplication it removes; buttons DO get a real component
// (components/Button.tsx), but its class string lives here too - see
// buttonClasses below for why it can't live in that file.
//
// Same purpose either way: one definition, so the call sites can't drift.
// Before this, three files declared their own near-identical input string and
// two more inlined it per field.

type FieldSize = 'sm' | 'md';

const FIELD_SIZES: Record<FieldSize, string> = {
  sm: 'px-2 py-1.5 text-sm',
  md: 'px-4 py-2',
};

/**
 * A text input, select or textarea.
 *
 * NOTE the background is `inset`, one step DARKER than the card it sits on,
 * not the same step. Inputs used to be bg-zinc-800 on a bg-zinc-800 card,
 * separated by their border alone - a known issue since 7/24. An input is a
 * hole you type into, so reading as recessed is also just more truthful than
 * reading as flush.
 *
 * Focus is a ring, not a border colour swap. The old rule was
 * `focus:outline-none focus:border-violet-500`, which removes the browser's
 * own focus indicator and replaces it with a 1px colour change that's very
 * easy to miss when tabbing. focus-visible keeps it off during mouse clicks.
 */
export function inputClasses(size: FieldSize = 'md', className = ''): string {
  // Deliberately NOT w-full - MeetingPanel's date/time/duration fields sit
  // side by side in a flex row and size themselves. Callers that want full
  // width pass it in.
  return `bg-inset text-white border border-line rounded-md transition-colors
    hover:border-line-strong
    focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand-hover/60
    ${FIELD_SIZES[size]} ${className}`;
}

/* ------------------------------------------------------------------------ *
 * BUTTONS
 *
 * These live here rather than in components/Button.tsx because that file also
 * default-exports a component, and a module exporting both a component and
 * something else breaks React Fast Refresh - eslint's
 * `react-refresh/only-export-components` flags it, and it was the one lint
 * error in the project. Same reasoning that split useTeam.ts out of
 * TeamContext.tsx.
 *
 * COLOUR RULE: every variant here is brand, neutral or red - never a schedule
 * colour. Violet means "you can act on this" and is reserved for that. The
 * grid's sage / rose / amber mean what's on the calendar and never appear on
 * a control. Ignoring that is how the overlap row and the primary button ended
 * up rendering the exact same hex.
 * ------------------------------------------------------------------------ */

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md';

// Two sizes, not three. `sm` is for controls sitting inside a card or a dense
// row; `md` is for a form's own submit. The old py-3 full-width submit is
// covered by md plus a w-full from the caller.
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

// `outline` is the tinted-border style MeetingPanel already used for its
// booking controls - kept as a real variant rather than normalised away,
// because a panel with a filled primary button in it competes with the
// page's actual primary action.
const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
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
 * The button class string on its own. Used by the Button component itself, and
 * directly by the cases that must render something other than a <button> but
 * should look identical - a react-router <Link> styled as a button, mainly.
 * Without this those call sites go back to hand-copying the classes, which is
 * the drift this exists to stop.
 */
export function buttonClasses(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'sm',
  className = ''
): string {
  return `inline-block rounded-md font-medium transition-colors cursor-pointer
    disabled:opacity-50 disabled:cursor-not-allowed
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-hover/60
    ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`;
}
