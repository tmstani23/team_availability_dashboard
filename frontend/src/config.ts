// Single source for the backend URL. Vite only exposes env vars prefixed
// VITE_ to client code, and import.meta.env is replaced at build time, not
// read at runtime - so whatever VITE_API_URL is set to when you build is
// baked into that build permanently.
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';
