import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runDailyQuiz } from "@/lib/current-affairs/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Stores the RBI's latest press releases and writes today's quiz from them.
 * Daily, early morning India time. Idempotent — see runDailyQuiz.
 *
 * "Too little news" is a normal outcome, not an error, so it returns 200: a
 * red scheduled run should mean something is actually broken.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await runDailyQuiz(createAdminClient());
  return NextResponse.json(report, { status: report.status === "failed" ? 500 : 200 });
}
