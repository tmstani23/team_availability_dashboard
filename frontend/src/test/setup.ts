// Runs once before every test file (wired up as `setupFiles` in
// vite.config.ts). Two jobs, both of which the component tests break without.

// 1. The jest-dom matchers - toBeInTheDocument, toHaveValue and friends. The
//    '/vitest' subpath is the one that registers them with Vitest's `expect`
//    AND augments its TypeScript types; importing the bare package registers
//    nothing here.
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// 2. Unmount whatever the last test rendered.
//
//    React Testing Library normally installs this itself, but ONLY when a
//    global `afterEach` exists - which means only when Vitest runs with
//    `globals: true`. This project doesn't (the existing util suites import
//    describe/it/expect explicitly, and that's worth keeping), so the
//    auto-cleanup silently never installs. Without it every render stays in
//    the document and the next test's queries match two of everything.
afterEach(cleanup);
