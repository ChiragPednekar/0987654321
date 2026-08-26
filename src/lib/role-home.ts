import type { UserRole } from "@/lib/types/database";

/**
 * Where each role lives.
 *
 * The three dashboards are separate products that happen to share a database.
 * A teacher signing in wants their marking queue, not a case library; the
 * platform owner wants licences and margin, not a skill radar. Previously every
 * role was pushed to /dashboard after login and the sidebar's "Dashboard" link
 * pointed there for everyone, so an admin clicking the most obvious link in
 * their own nav landed in the student experience.
 *
 * One function, used by the login form, the auth callback and the middleware,
 * so the three cannot disagree about where someone belongs.
 */
export function roleHome(role: UserRole | null | undefined): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "teacher":
      return "/teacher";
    case "recruiter":
      return "/recruiter";
    default:
      return "/dashboard";
  }
}

/**
 * The home paths that belong to somebody else.
 *
 * Used to bounce a role off another role's landing page — an admin who lands on
 * /dashboard is sent to /admin rather than shown a student dashboard with all
 * their numbers at zero.
 */
export const ROLE_HOMES = ["/dashboard", "/teacher", "/admin", "/recruiter"] as const;

/**
 * True when `pathname` is a role's home page and that role is not this one.
 *
 * Deliberately exact-match: /admin redirects a teacher away, but /admin/... is
 * left to the layout guard, which returns a proper 403/redirect with context
 * rather than silently bouncing someone mid-task.
 */
export function isForeignHome(pathname: string, role: UserRole | null): boolean {
  const home = roleHome(role);
  return (ROLE_HOMES as readonly string[]).includes(pathname) && pathname !== home;
}
