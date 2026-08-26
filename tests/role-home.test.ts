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

describe("privilege flows downward", () => {
  it("lets the platform owner open every dashboard", () => {
    // requireTeacherActor() has always allowed an admin into the teaching
    // area so the owner can see what teachers see. Bouncing them here would
    // silently override that — which it did, until this test existed.
    for (const path of ROLE_HOMES) {
      expect(canOpenHome(path, "admin")).toBe(true);
      expect(mustRedirectFromHome(path, "admin")).toBe(false);
    }
  });

  it("lets a teacher open the teaching and student areas", () => {
    expect(canOpenHome("/teacher", "teacher")).toBe(true);
    expect(canOpenHome("/dashboard", "teacher")).toBe(true);
  });

  it("keeps a teacher out of the admin dashboard", () => {
    expect(canOpenHome("/admin", "teacher")).toBe(false);
    expect(mustRedirectFromHome("/admin", "teacher")).toBe(true);
  });

  it("keeps a student out of the teaching and admin dashboards", () => {
    for (const path of ["/teacher", "/admin", "/recruiter"]) {
      expect(canOpenHome(path, "student")).toBe(false);
      expect(mustRedirectFromHome(path, "student")).toBe(true);
    }
  });

  it("lets every signed-in account open the student dashboard", () => {
    for (const role of ["student", "teacher", "admin", "recruiter"] as const) {
      expect(canOpenHome("/dashboard", role)).toBe(true);
    }
  });

  it("never bounces a page that is not a role home", () => {
    for (const path of ["/cases", "/classrooms", "/teacher/batches", "/admin/users"]) {
      for (const role of ["student", "teacher", "admin"] as const) {
        expect(mustRedirectFromHome(path, role)).toBe(false);
      }
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
