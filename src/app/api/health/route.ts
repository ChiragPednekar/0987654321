import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness and startup probe for Cloud Run.
 *
 * Deliberately does not touch the database. A probe that queries Postgres turns
 * a brief database hiccup into Cloud Run killing every healthy instance and
 * refusing to start replacements — the outage amplifies instead of riding out.
 * Readiness of dependencies belongs in monitoring, not in the liveness path.
 */
export async function GET() {
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
