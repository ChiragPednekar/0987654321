import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Rebuilds all-time, weekly and monthly rankings. Runs every 10 minutes. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const [{ error: leaderboardError }, { error: contestError }] =
    await Promise.all([
      admin.rpc("refresh_leaderboards"),
      admin.rpc("sync_contest_statuses"),
    ]);

  if (leaderboardError || contestError) {
    console.error("[cron] refresh failed", leaderboardError ?? contestError);
    return NextResponse.json(
      { error: (leaderboardError ?? contestError)?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, refreshed_at: new Date().toISOString() });
}
