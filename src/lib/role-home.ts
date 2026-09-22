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
 * ONE EXCEPTION: the platform owner may open all three.
 *
 * This was tried once before and reverted, and the reason it failed is worth
 * keeping in view — the owner could open /teacher and /dashboard "to inspect",
 * and clicking the wrong link SILENTLY landed them in the student product. The
 * defect was the silence, not the access: nothing on screen said which surface
 * you were standing on, so an empty student dashboard looked like a bug in the
 * product rather than the owner being in the wrong place.
 *
 * So the access is back and the silence is not. An owner outside /admin gets a
 * banner saying so, with a way back. Every other role stays walled: a teacher
 * opening /admin is a privilege question, not a convenience one, and the
 * answer to it is still no.
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

  // The owner may stand anywhere. Nothing is exposed by this that admin did
  // not already have — is_admin() already reads every row in the database —
  // so this is a navigation decision, not a privilege one.
  if (role === "admin") return true;

  return pathname === roleHome(role);
}

/**
 * True when this role is standing on a dashboard that is not its own.
 *
 * Only the owner can be in this state, and the interface has to say so. The
 * last version of this feature was withdrawn precisely because it did not.
 */
export function isVisitingAnotherHome(
  pathname: string,
  role: UserRole | null,
): boolean {
  if (!role) return false;
  if (!(ROLE_HOMES as readonly string[]).includes(pathname)) return false;
  return pathname !== roleHome(role);
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
