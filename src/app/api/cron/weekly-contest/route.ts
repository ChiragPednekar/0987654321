import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weekly contest rollover. Intended to run every Friday morning UTC.
 *
 * 1. Finalises any contest whose window has closed (applies speed bonus, ranks).
 * 2. Opens a new contest for the coming weekend on a case that has not been
 *    featured before.
 *
 * Window: opens Friday, closes Sunday end of day.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  // ---- 1. finalise anything that has closed --------------------------------
  const { data: closable } = await admin
    .from("contests")
    .select("id")
    .lt("ends_at", now.toISOString())
    .neq("status", "completed");

  const finalised: string[] = [];
  for (const contest of closable ?? []) {
    const { error } = await admin.rpc("finalize_contest", {
      p_contest_id: contest.id,
    });
    if (error) {
      console.error("[cron] finalize failed", contest.id, error);
    } else {
      finalised.push(contest.id);
    }
  }

  // Ranks changed, so rebuild the boards.
  await admin.rpc("refresh_leaderboards");

  // ---- 2. is a contest already scheduled or running? -----------------------
  const { data: upcoming } = await admin
    .from("contests")
    .select("id")
    .gte("ends_at", now.toISOString())
    .limit(1);

  if (upcoming && upcoming.length > 0) {
    return NextResponse.json({
      ok: true,
      finalised,
      created: null,
      reason: "A contest is already open or scheduled.",
    });
  }

  // ---- 3. choose a case that has never been featured ----------------------
  const { data: usedRows } = await admin.from("contests").select("case_id");
  const used = (usedRows ?? []).map((row) => row.case_id);

  let candidateQuery = admin
    .from("cases")
    .select("id, title, slug")
    .eq("is_published", true)
    .in("difficulty", ["medium", "hard"]);

  if (used.length > 0) {
    candidateQuery = candidateQuery.not("id", "in", `(${used.join(",")})`);
  }

  const { data: candidates } = await candidateQuery.limit(50);

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      finalised,
      created: null,
      reason: "No unused cases available to feature.",
    });
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];

  // ---- 4. build the weekend window ----------------------------------------
  const startsAt = nextWeekday(now, 5); // Friday
  startsAt.setUTCHours(0, 0, 0, 0);

  const endsAt = new Date(startsAt);
  endsAt.setUTCDate(endsAt.getUTCDate() + 2); // Sunday
  endsAt.setUTCHours(23, 59, 59, 0);

  const isoWeek = getIsoWeek(startsAt);
  const slug = `weekly-${startsAt.getUTCFullYear()}-w${String(isoWeek).padStart(2, "0")}`;

  const { data: created, error } = await admin
    .from("contests")
    .insert({
      slug,
      title: `Weekly Contest ${isoWeek}`,
      description:
        "One case, two hours on your personal timer. Finish faster for a bigger speed bonus. Submissions close Sunday night.",
      case_id: pick.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      duration_minutes: 120,
      max_speed_bonus: 20,
      status: "scheduled",
      is_published: true,
    })
    .select("id, slug")
    .single();

  if (error) {
    // A duplicate slug means a concurrent run already created this week's
    // contest — not an error worth alerting on.
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, finalised, created: null });
    }
    console.error("[cron] contest creation failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, finalised, created });
}

/** The next occurrence of `weekday` (0=Sun … 6=Sat), or today if it matches. */
function nextWeekday(from: Date, weekday: number): Date {
  const result = new Date(from);
  const delta = (weekday - result.getUTCDay() + 7) % 7;
  result.setUTCDate(result.getUTCDate() + delta);
  return result;
}

function getIsoWeek(date: Date): number {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  return (
    1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
  );
}
