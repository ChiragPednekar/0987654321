import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { checkOfficialLinks } from "@/lib/link-check";
import { purgeExpiredSnapshots } from "@/lib/proctor-evidence";

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

  /**
   * Once a week, also check that the firms' own careers links still resolve.
   *
   * Riding along here rather than on its own schedule because Vercel's Hobby
   * plan caps how many cron entries a project may declare, and a third would
   * have risked failing the deploy to schedule something that runs weekly.
   * Monday, after the leaderboard work is already done and committed.
   *
   * Never allowed to fail this route: a careers site being slow must not stop
   * the leaderboards refreshing.
   */
  let links: Awaited<ReturnType<typeof checkOfficialLinks>> | null = null;
  if (new Date().getUTCDay() === 1) {
    try {
      links = await checkOfficialLinks(admin);
    } catch (error) {
      console.error(
        "[cron] weekly link check failed",
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Camera evidence photos past the 30 days the consent notice promises.
   *
   * Here rather than on its own schedule for the same Hobby-plan reason as the
   * link check, and daily so the promise is kept to the day. Never allowed to
   * fail the route: a storage hiccup must not stop the leaderboards — it only
   * means tomorrow's run deletes a little more.
   */
  let purged: number | string = 0;
  try {
    purged = (await purgeExpiredSnapshots(admin)).deleted;
  } catch (error) {
    purged = "failed";
    console.error(
      "[cron] snapshot purge failed",
      error instanceof Error ? error.message : error,
    );
  }

  return NextResponse.json({
    ok: true,
    snapshots_purged: purged,
    refreshed_at: new Date().toISOString(),
    link_check: links ? { checked: links.checked, broken: links.broken.length } : "not today",
  });
}
