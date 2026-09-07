import type { UserRole } from "@/lib/types/database";

/**
 * Where each role lives.
 *
 * The three dashboards are separate products that happen to share a database.
 * Each account signs in and stays inside its own one: a student solves cases, a
 * teacher runs batches and marks work, the platform owner watches licences and
 * usage. None of them can reach another's dashboard, and no navigation offers
 * the trip.
 *
 * That strictness is deliberate and was arrived at the hard way. An earlier
 * version let privilege flow downward — the owner could open /teacher and
 * /dashboard "to inspect" — which meant a teacher or the owner clicking the
 * wrong link silently landed in the student product with somebody else's
 * numbers on screen. Inspecting another dashboard is what the other account is
 * for; there are three logins precisely so that no single session has to
 * straddle two roles.
 *
 * Deeper paths are a different question. /cases and /classrooms are shared
 * *features* rather than dashboards — a teacher has to browse the library to
 * assign from it, and /classrooms is where the teacher and student sides meet.
 * Only the four home paths below are walled.
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
 * May this role open this dashboard?
 *
 * Exactly one answer per role: its own, and nothing else. A role standing on
 * another's home is redirected back to where it belongs.
 */
export function canOpenHome(pathname: string, role: UserRole | null): boolean {
  // Not a role home — this function has no opinion on it.
  if (!(ROLE_HOMES as readonly string[]).includes(pathname)) return true;

  // An unknown role is not bounced anywhere. A failed profile read must not
  // turn into a redirect, which is how the login/dashboard loop happened.
  if (!role) return true;

  return pathname === roleHome(role);
}

/**
 * True when the role must be redirected away from `pathname`.
 *
 * Only role *homes* are considered. Deeper paths are left to the layout guards,
 * which answer with context instead of silently bouncing someone mid-task.
 */
export function mustRedirectFromHome(
  pathname: string,
  role: UserRole | null,
): boolean {
  return !canOpenHome(pathname, role);
}
