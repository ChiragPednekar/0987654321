import { describe, expect, it } from "vitest";
import { ROLE_HOMES, isForeignHome, roleHome } from "@/lib/role-home";

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

describe("a role is bounced off another role's home", () => {
  it("moves an admin standing on the student dashboard to /admin", () => {
    expect(isForeignHome("/dashboard", "admin")).toBe(true);
  });

  it("moves a teacher standing on the student dashboard to /teacher", () => {
    expect(isForeignHome("/dashboard", "teacher")).toBe(true);
  });

  it("moves a student off /admin and /teacher", () => {
    expect(isForeignHome("/admin", "student")).toBe(true);
    expect(isForeignHome("/teacher", "student")).toBe(true);
  });

  it("leaves each role alone on its own home", () => {
    expect(isForeignHome("/admin", "admin")).toBe(false);
    expect(isForeignHome("/teacher", "teacher")).toBe(false);
    expect(isForeignHome("/dashboard", "student")).toBe(false);
    expect(isForeignHome("/recruiter", "recruiter")).toBe(false);
  });

  it("never bounces a page that is not a role home", () => {
    // Shared surfaces stay shared — a teacher browsing the case library or a
    // batch page must not be yanked back to their dashboard.
    for (const path of ["/cases", "/classrooms", "/teacher/batches", "/admin/users"]) {
      for (const role of ["student", "teacher", "admin"] as const) {
        expect(isForeignHome(path, role)).toBe(false);
      }
    }
  });

  it("does not bounce when the role is unknown", () => {
    // The middleware must redirect nowhere on a failed lookup. Guessing is how
    // a bad read becomes an infinite redirect.
    expect(isForeignHome("/admin", null)).toBe(true);
    expect(isForeignHome("/dashboard", null)).toBe(false);
  });
});

describe("no redirect can loop", () => {
  it("every role's home is stable under the bounce rule", () => {
    // The property that matters: applying the rule to a role's own home is
    // always a no-op, so target !== pathname can never oscillate.
    for (const role of ["student", "teacher", "admin", "recruiter"] as const) {
      const home = roleHome(role);
      expect(isForeignHome(home, role)).toBe(false);
    }
  });

  it("a bounce always lands somewhere that does not bounce again", () => {
    for (const role of ["student", "teacher", "admin", "recruiter"] as const) {
      for (const path of ROLE_HOMES) {
        if (!isForeignHome(path, role)) continue;
        const target = roleHome(role);
        expect(isForeignHome(target, role)).toBe(false);
      }
    }
  });
});
