import { describe, expect, it } from "vitest";
import { ROLE_HOMES, canOpenHome, mustRedirectFromHome, roleHome } from "@/lib/role-home";

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
        expect(canOpenHome(path, role)).toBe(path === home);
      }
    }
  });

  it("bounces a teacher off the student dashboard", () => {
    // The complaint this exists for: a teacher clicking a stray link landed on
    // /dashboard and saw the student product with somebody else's numbers.
    expect(canOpenHome("/dashboard", "teacher")).toBe(false);
    expect(mustRedirectFromHome("/dashboard", "teacher")).toBe(true);
  });

  it("bounces the platform owner off both other dashboards", () => {
    // Deliberate, and a reversal: an earlier version let the owner "inspect"
    // /teacher and /dashboard. Three separate logins exist so no session has to
    // straddle two roles — inspecting the teacher product means signing in as
    // the teacher.
    expect(canOpenHome("/teacher", "admin")).toBe(false);
    expect(canOpenHome("/dashboard", "admin")).toBe(false);
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
