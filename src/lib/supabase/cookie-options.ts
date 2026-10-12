/**
 * How the session cookie is set, in one place for the browser, server and
 * proxy clients — they must agree, or each rewrites the others' cookie.
 *
 *   * SameSite=Lax: the browser leaves the cookie off a POST that another site
 *     starts, which is the main defence against cross-site request forgery
 *     (the proxy's origin check is the second).
 *   * Secure in production: never sent over plain HTTP, even if something
 *     ever downgrades a request before HSTS takes hold. Not in development,
 *     where localhost is plain HTTP and the cookie would never be set.
 *
 * Not HttpOnly, by Supabase's design: the browser client reads the session
 * from it for realtime and token refresh. The Content-Security-Policy in
 * next.config.ts is what stands between a script injection and that cookie.
 */
export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
