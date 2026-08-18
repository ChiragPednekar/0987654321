import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Verifies the shared secret Vercel Cron sends as `Authorization: Bearer …`.
 * Compared in constant time so the endpoint can't be brute-forced by timing.
 */
export function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(header);
  const b = Buffer.from(expected);

  // timingSafeEqual throws on length mismatch, so guard first. The length of
  // the secret is not itself sensitive.
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
