import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { buttonClasses, type ButtonVariant, type ButtonSize } from '../utils/ui';

// The one place a button is styled. Before this, every call site restated the
// full class string, and they had drifted: LoginForm and AddTeamMemberForm had
// active: states, HoursEditor and TeamMemberCard didn't; some had
// disabled:opacity-50 and some didn't; padding came in three sizes with no
// pattern behind which went where.
//
// Same argument as STATUS_META and scheduleTime.ts - when a rule is restated
// per call site, the call sites are what drift. Putting it in one place means a
// change to how a button looks is one edit, and a NEW button can't invent a
// fourth size by accident.
//
// The class string itself now lives in utils/ui.ts, next to inputClasses. It
// moved because this module default-exports a component, and a module that
// exports both a component and a plain function can't be hot-reloaded -
// eslint's react-refresh/only-export-components was flagging exactly that.
// Call sites that styled a <Link> as a button import buttonClasses from
// utils/ui directly now.

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  // Escape hatch for LAYOUT only (w-full, self-start, mt-6). Resist passing
  // colours through here - that's how the per-call-site drift started.
  className?: string;
  children: ReactNode;
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
