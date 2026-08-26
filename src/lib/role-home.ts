import type { UserRole } from "@/lib/types/database";

/**
 * Where each role lives, and which homes it may open.
 *
 * The three dashboards are separate products sharing a database. A teacher
 * signing in wants their marking queue, not a case library; the platform owner
 * wants licences and margin, not a skill radar. Every role used to be pushed to
 * /dashboard after login, so the owner clicking the most obvious link in their
 * own navigation landed in the student experience.
 *
 * Two different questions, deliberately kept apart:
 *
 *   roleHome()      where you LAND — one answer per role, used by the login
 *                   form and the middleware.
 *   canOpenHome()   where you are ALLOWED — a privilege check, which is a
 *                   strictly weaker condition.
 *
 * Conflating them is a mistake I already made once: bouncing every role off
 * every home but its own also locked the platform owner out of the teacher
 * dashboard, which requireTeacherActor() explicitly permits so the owner can
 * see what teachers see without keeping a second account.
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

export const ROLE_HOMES = ["/dashboard", "/teacher", "/admin", "/recruiter"] as const;

/**
 * May this role open this dashboard at all?
 *
 * Privilege flows downward — the platform owner can open anything, a teacher
 * can open the teaching and student areas, a student only their own. So the
 * separation people notice is the landing (each account starts in its own
 * product) rather than a wall that traps them there.
 *
 * `/dashboard` is open to every signed-in account on purpose: a teacher is also
 * a person who can solve cases, and nothing there is privileged.
 */
export function canOpenHome(pathname: string, role: UserRole | null): boolean {
  switch (pathname) {
    case "/admin":
      return role === "admin";
    case "/teacher":
      return role === "teacher" || role === "admin";
    case "/recruiter":
      return role === "recruiter" || role === "admin";
    case "/dashboard":
      return true;
    default:
      // Not a role home; this function has no opinion.
      return true;
  }
}

/**
 * True when the role must be redirected away from `pathname`.
 *
 * Only role *homes* are considered. Deeper paths are left to the layout guards,
 * which can answer with context instead of silently bouncing someone mid-task.
 */
export function mustRedirectFromHome(
  pathname: string,
  role: UserRole | null,
): boolean {
  if (!(ROLE_HOMES as readonly string[]).includes(pathname)) return false;
  return !canOpenHome(pathname, role);
}
