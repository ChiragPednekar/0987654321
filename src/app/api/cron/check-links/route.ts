import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { checkOfficialLinks } from "@/lib/link-check";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Runs the official-link check on demand.
 *
 * The weekly run is driven from the daily leaderboard cron rather than its own
 * schedule entry, because Vercel's Hobby plan caps how many a project may
 * declare. This route stays so the check can be triggered by hand — after
 * adding links, or when a firm announces a careers-site migration.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await checkOfficialLinks(createAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Link check failed";
    console.error("[cron] link check failed", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
