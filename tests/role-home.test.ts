import { describe, expect, it } from "vitest";
import {
  ROLE_HOMES,
  canOpenHome,
  isVisitingAnotherHome,
  mustRedirectFromHome,
  roleHome,
} from "@/lib/role-home";

/**
 * The three dashboards are separate entities.
 *
 * Each role signs in and lands on its own product. The bug this guards against
 * is the one that shipped: every role was pushed to /dashboard after login, and
 * the sidebar's "Dashboard" link pointed there for everyone — so the platform
 * owner clicking the most obvious link in their own navigation ended up in the
 * student experience.
 */

describe("each role has its own home", () => {
  it("sends the platform owner to the admin dashboard", () => {
    expect(roleHome("admin")).toBe("/admin");
  });

  it("sends a teacher to the teaching dashboard", () => {
    expect(roleHome("teacher")).toBe("/teacher");
  });

  it("sends a student to the student dashboard", () => {
    expect(roleHome("student")).toBe("/dashboard");
  });

  it("sends a recruiter to the recruiter dashboard", () => {
    expect(roleHome("recruiter")).toBe("/recruiter");
  });

  it("falls back to the student dashboard for an unknown or missing role", () => {
    // A failed profile read must not strand someone on an error; the least
    // privileged home is the safe default.
    expect(roleHome(null)).toBe("/dashboard");
    expect(roleHome(undefined)).toBe("/dashboard");
  });

  it("gives every role a distinct home", () => {
    const homes = (["student", "teacher", "admin", "recruiter"] as const).map(roleHome);
    expect(new Set(homes).size).toBe(homes.length);
  });

  it("lists every home in ROLE_HOMES", () => {
    for (const role of ["student", "teacher", "admin", "recruiter"] as const) {
      expect(ROLE_HOMES).toContain(roleHome(role));
    }
  });
});

describe("each role is walled into its own dashboard", () => {
  it("lets every role open its own home and nothing else", () => {
    for (const role of ["student", "teacher", "admin", "recruiter"] as const) {
      const home = roleHome(role);
      for (const path of ROLE_HOMES) {
        // The owner is the documented exception and is checked separately.
        expect(canOpenHome(path, role)).toBe(role === "admin" || path === home);
      }
    }
  });

  it("bounces a teacher off the student dashboard", () => {
    // The complaint this exists for: a teacher clicking a stray link landed on
    // /dashboard and saw the student product with somebody else's numbers.
    expect(canOpenHome("/dashboard", "teacher")).toBe(false);
    expect(mustRedirectFromHome("/dashboard", "teacher")).toBe(true);
  });

  it("lets the platform owner open every dashboard", () => {
    // Reversed deliberately, at the owner's request. Nothing is exposed that
    // admin did not already have — is_admin() reads every row in the database
    // — so this is navigation, not privilege.
    for (const path of ROLE_HOMES) {
      expect(canOpenHome(path, "admin")).toBe(true);
      expect(mustRedirectFromHome(path, "admin")).toBe(false);
    }
  });

  it("tells the owner when they are standing somewhere that is not theirs", () => {
    // The reason the previous attempt at this was withdrawn: it was SILENT, so
    // an empty student dashboard read as a broken product rather than as the
    // owner being in the wrong place.
    expect(isVisitingAnotherHome("/dashboard", "admin")).toBe(true);
    expect(isVisitingAnotherHome("/teacher", "admin")).toBe(true);
    expect(isVisitingAnotherHome("/admin", "admin")).toBe(false);
  });

  it("says nothing about a role standing on its own home, or off a home", () => {
    expect(isVisitingAnotherHome("/dashboard", "student")).toBe(false);
    expect(isVisitingAnotherHome("/cases", "admin")).toBe(false);
    expect(isVisitingAnotherHome("/dashboard", null)).toBe(false);
  });

  it("does NOT widen the wall for anyone else", () => {
    // Widening this for admin must not leak into the roles it protects. A
    // teacher opening /admin is a privilege question and the answer is no.
    expect(canOpenHome("/admin", "teacher")).toBe(false);
    expect(canOpenHome("/admin", "student")).toBe(false);
    expect(canOpenHome("/admin", "recruiter")).toBe(false);
    expect(canOpenHome("/teacher", "student")).toBe(false);
    expect(canOpenHome("/dashboard", "teacher")).toBe(false);
  });

  it("keeps a student out of the teaching and admin dashboards", () => {
    for (const path of ["/teacher", "/admin", "/recruiter"]) {
      expect(mustRedirectFromHome(path, "student")).toBe(true);
    }
  });

  it("leaves shared features alone", () => {
    // /cases and /classrooms are features, not dashboards. A teacher has to
    // browse the library to assign from it, and /classrooms is where the
    // teacher and student sides actually meet.
    for (const path of ["/cases", "/classrooms", "/teacher/batches", "/admin/users", "/leaderboard"]) {
      for (const role of ["student", "teacher", "admin"] as const) {
        expect(mustRedirectFromHome(path, role)).toBe(false);
      }
    }
  });

  it("does not bounce an unknown role anywhere", () => {
    // A failed profile read must not become a redirect — that is how the
    // login/dashboard loop happened.
    for (const path of ROLE_HOMES) {
      expect(mustRedirectFromHome(path, null)).toBe(false);
    }
  });
});

describe("no redirect can loop", () => {
  it("every role may open its own home", () => {
    for (const role of ["student", "teacher", "admin", "recruiter"] as const) {
      expect(mustRedirectFromHome(roleHome(role), role)).toBe(false);
    }
  });

  it("a bounce always lands somewhere that does not bounce again", () => {
    for (const role of ["student", "teacher", "admin", "recruiter"] as const) {
      for (const path of ROLE_HOMES) {
        if (!mustRedirectFromHome(path, role)) continue;
        expect(mustRedirectFromHome(roleHome(role), role)).toBe(false);
      }
    }
  });
});
