// Shared control styling that isn't a component. Buttons got a real component
// (components/Button.tsx) because they're always a <button> or a <Link>;
// inputs come as <input>, <select> and <textarea> with different props and
// different children rules, so a wrapper component would be more ceremony
// than the duplication it removes. A class string is the honest shape here.
//
// Same purpose as Button either way: one definition, so the call sites can't
// drift. Before this, three files declared their own near-identical input
// string and two more inlined it per field.

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
