import { describe, expect, it, vi } from "vitest";
import {
  activatePaidPeriod,
  canRenew,
  nextPeriodEnd,
  RENEWAL_WINDOW_DAYS,
  SUBSCRIPTION_DAYS,
} from "@/lib/subscription";

const DAY = 86_400_000;
const NOW = new Date("2026-10-17T06:00:00Z");
const days = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DAY);

describe("nextPeriodEnd", () => {
  it("starts a first subscription today and runs a year", () => {
    expect(days(nextPeriodEnd(null, SUBSCRIPTION_DAYS, NOW), NOW)).toBe(365);
  });

  it("adds a renewal to whatever is left, so renewing early loses nothing", () => {
    const left20 = new Date(NOW.getTime() + 20 * DAY);
    expect(days(nextPeriodEnd(left20, SUBSCRIPTION_DAYS, NOW), NOW)).toBe(385);
  });

  it("starts from today when the old period has already ended", () => {
    const ended = new Date(NOW.getTime() - 40 * DAY);
    expect(days(nextPeriodEnd(ended, SUBSCRIPTION_DAYS, NOW), NOW)).toBe(365);
  });
});

describe("canRenew", () => {
  it(`opens in the last ${RENEWAL_WINDOW_DAYS} days`, () => {
    expect(canRenew(new Date(NOW.getTime() + 200 * DAY), NOW)).toBe(false);
    expect(canRenew(new Date(NOW.getTime() + RENEWAL_WINDOW_DAYS * DAY), NOW)).toBe(true);
    expect(canRenew(new Date(NOW.getTime() + 5 * DAY), NOW)).toBe(true);
  });
});

/** A minimal stand-in for the two queries activatePaidPeriod makes. */
function fakeDb({ alreadyActive }: { alreadyActive: boolean }) {
  const updates: unknown[] = [];
  const stored = "2027-10-17T06:00:00.000Z";
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "gt", "order", "limit", "update", "insert"]) c[m] = vi.fn(() => c);
    c.maybeSingle = vi.fn(async () => result);
    c.then = (resolve: (v: unknown) => void) => resolve(result);
    return c;
  };
  let call = 0;
  const admin = {
    from: vi.fn(() => {
      call += 1;
      if (call === 1) return chain({ data: null }); // activeSubscription: none live yet
      if (call === 2) {
        const c = chain({ data: alreadyActive ? [] : [{ id: "sub-1" }] });
        c.update = vi.fn((v: unknown) => {
          updates.push(v);
          return c;
        });
        return c;
      }
      return chain({ data: { current_period_end: stored } }); // read-back
    }),
  };
  return { admin, updates, stored };
}

describe("activatePaidPeriod", () => {
  it("activates a verified payment once, with a year's period", async () => {
    const { admin, updates } = fakeDb({ alreadyActive: false });
    const r = await activatePaidPeriod(admin as never, { subscriptionId: "sub-1", userId: "u", paymentId: "pay_1" });
    expect(r.activated).toBe(true);
    expect(updates).toHaveLength(1);
    expect((updates[0] as { status: string }).status).toBe("active");
  });

  it("does not credit the same payment twice when the webhook and the browser both confirm it", async () => {
    const { admin, stored } = fakeDb({ alreadyActive: true });
    const r = await activatePaidPeriod(admin as never, { subscriptionId: "sub-1", userId: "u", paymentId: "pay_1" });
    expect(r.activated).toBe(false);
    expect(r.endsAt).toBe(stored);
  });
});
