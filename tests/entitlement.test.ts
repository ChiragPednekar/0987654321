import { describe, expect, it, vi } from "vitest";
import { canSolve, SOLVE_DENIAL } from "@/lib/entitlement";

/**
 * canSolve is a thin wrapper over public.can_solve(), which holds the single
 * definition of who may practise: a staff role, a named individual, a live
 * subscription period (or Pro granted by hand), or a campus licence seat.
 * There is deliberately no second copy of those rules here.
 */
const rpcReturning = (result: { data: unknown; error: { message: string } | null }) => ({
  rpc: vi.fn().mockResolvedValue(result),
  from: vi.fn(() => {
    throw new Error("canSolve must not read tables itself — can_solve() is the only definition");
  }),
});

describe("canSolve", () => {
  it("allows the account when can_solve() says so", async () => {
    const admin = rpcReturning({ data: true, error: null });
    expect(await canSolve(admin as never, "user-1")).toBe(true);
    expect(admin.rpc).toHaveBeenCalledWith("can_solve", { p_user: "user-1" });
  });

  it("refuses when can_solve() says no — there is no second, looser check", async () => {
    expect(await canSolve(rpcReturning({ data: false, error: null }) as never, "user-2")).toBe(false);
  });

  it("fails CLOSED when the check cannot be made — this is the paywall", async () => {
    const silence = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await canSolve(rpcReturning({ data: null, error: { message: "timeout" } }) as never, "user-3")).toBe(false);
    silence.mockRestore();
  });

  it("tells a refused student both ways in", () => {
    expect(SOLVE_DENIAL.code).toBe("not_entitled");
    expect(SOLVE_DENIAL.error).toMatch(/subscribe/i);
    expect(SOLVE_DENIAL.error).toMatch(/college/i);
  });
});
