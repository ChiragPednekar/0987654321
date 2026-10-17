import { afterEach, describe, expect, it, vi } from "vitest";
import { checkoutMode, checkoutModeFor } from "@/lib/billing/checkout-mode";

/**
 * Sign-up is open, so a demo checkout open to everyone on production would
 * hand any stranger free Pro — real model spend. These pin the rule: on
 * production only listed testers and admins get the demo; Razorpay, once
 * configured, wins for everyone.
 */
function admin({ listed, role }: { listed: boolean; role: string }) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            table === "access_allowlist"
              ? { data: listed ? { email: "t@example.com" } : null }
              : { data: { role } },
        }),
      }),
    }),
  } as never;
}

describe("checkout mode", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses Razorpay as soon as the keys exist", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_x");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "secret");
    vi.stubEnv("NODE_ENV", "production");
    expect(checkoutMode()).toBe("razorpay");
    expect(await checkoutModeFor(admin({ listed: false, role: "student" }), { id: "u", email: "x@y.z" })).toBe("razorpay");
  });

  it("closes the demo to strangers on production", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(await checkoutModeFor(admin({ listed: false, role: "student" }), { id: "u", email: "x@y.z" })).toBe("closed");
  });

  it("keeps the demo for listed testers and admins on production", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(await checkoutModeFor(admin({ listed: true, role: "student" }), { id: "u", email: "t@example.com" })).toBe("demo");
    expect(await checkoutModeFor(admin({ listed: false, role: "admin" }), { id: "u", email: "a@example.com" })).toBe("demo");
  });

  it("can switch the demo off entirely", () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    vi.stubEnv("DEMO_CHECKOUT", "off");
    expect(checkoutMode()).toBe("closed");
  });
});
