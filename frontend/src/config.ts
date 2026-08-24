// Single source for the backend URL. Vite only exposes env vars prefixed
// VITE_ to client code, and import.meta.env is replaced at build time, not
// read at runtime - so whatever VITE_API_URL is set to when you build is
// baked into that build permanently.
//
// The fallback splits on which build this is, and that split exists to close a
// silent trap. Deployed, the app is served by Express from the same origin as
// the API, so the right base is the empty string: every fetch becomes a
// relative /api/... path that lands wherever the page came from, whatever the
// domain turns out to be. A single hardcoded localhost fallback meant that
// building with the variable unset produced a bundle that looked fine, shipped
// fine, and asked a machine that isn't there for its data.
//
// import.meta.env.PROD is Vite's own flag - true for `vite build`, false for
// `vite dev` - so no extra configuration has to be right for this to work.
export const API_BASE =
  import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:5000');
