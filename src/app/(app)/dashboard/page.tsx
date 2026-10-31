import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { greetingFor, greetingName } from "@/lib/greeting";
import { plural } from "@/lib/utils";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { getQuotaStatus, type QuotaStatus } from "@/lib/quota";
import { preparationState } from "@/lib/placement/next-practice";
import {
  loadBenchmark,
  loadDailyDrill,
  loadFeaturedCase,
  loadLatestEvaluation,
  loadPracticeRecord,
  loadTargetFirms,
  loadTracks,
} from "@/lib/student-dashboard";
import { QuotaCard } from "@/components/quota-card";
import { dashFonts } from "@/components/dashboard/fonts";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { FeaturedCaseCard } from "@/components/dashboard/featured-case-card";
import { DailyDrillStrip, StreakBanner } from "@/components/dashboard/practice-strips";
import { PracticeTracks } from "@/components/dashboard/practice-tracks";
import { GlobalSearch } from "@/components/dashboard/global-search";
import { ExaminerEvaluation, PlacementBenchmark, TargetFirms } from "@/components/dashboard/insights-panel";
import { PracticeRecord } from "@/components/dashboard/practice-record";
import { eyebrow, panel } from "@/components/dashboard/primitives";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The student's home: what to do next in the main column (the plan's case,
 * the daily drill, the streak, skill tracks, the practice record) and how it
 * is going in the side panel (target firms, the latest marks, standing).
 * Every figure is read from this user's own rows; a card with nothing behind
 * it says so instead of showing a sample.
 */
export default async function DashboardPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/dashboard");

  const supabase = await createClient();

  // A recommendation is a nicety on this page, never a reason for it to fail.
  const plan = await preparationState(profile.id).catch((error) => {
    console.error("[dashboard] next practice unavailable", error);
    return null;
  });
  const planCase = plan?.plan.find((item) => item.key === "case") ?? null;

  const { data: domainRows } = await supabase
    .from("domain_progress")
    .select("domain, avg_percentage, cases_solved")
    .eq("user_id", profile.id);

  const now = new Date();
  const [featured, drill, tracks, firms, evaluation, benchmark, record] = await Promise.all([
    loadFeaturedCase(supabase, profile.id, planCase),
    loadDailyDrill(supabase, profile.id),
    loadTracks(supabase, profile.id),
    loadTargetFirms(supabase, profile.id),
    loadLatestEvaluation(supabase, profile.id),
    loadBenchmark(supabase, profile, domainRows ?? []),
    loadPracticeRecord(supabase, profile.id, domainRows ?? [], now.getTime()),
  ]);

  // Optional enrichment — a missing service-role key hides the allowance card
  // rather than taking the whole dashboard down.
  let quota: QuotaStatus | null = null;
  const quotaAdmin = createAdminClientOrNull();
  if (quotaAdmin) quota = await getQuotaStatus(quotaAdmin, profile.id);

  const today = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });

  // The plan puts a teacher's assignment, the diagnostic or an open college
  // assessment ahead of the case; say so rather than hide it.
  const ahead = plan && plan.next.href !== planCase?.href ? plan.next : null;

  return (
    <div className={`dash ${dashFonts} min-h-full bg-dx-page`}>
      <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:py-8 min-[1360px]:grid-cols-[minmax(0,1fr)_22rem] min-[1360px]:gap-8">
        <div className="min-w-0 space-y-6">
          <DashboardHeader
            greeting={greetingFor(now)}
            firstName={greetingName(profile.full_name)}
            today={today}
            subtitle={
              profile.cases_solved === 0
                ? "Your first case is the hardest. Start with the one below."
                : `${plural(profile.cases_solved, "case")} solved so far. Pick up where the plan says.`
            }
            streak={profile.current_streak}
            level={profile.level}
            ce={profile.ce}
          />

          {ahead && (
            <Link
              href={ahead.href}
              className={`${panel} group flex items-center justify-between gap-4 border-l-4 border-l-blue-600 p-4 transition-colors hover:bg-dx-hover`}
            >
              <div className="min-w-0">
                <p className={`${eyebrow} text-blue-700 dark:text-blue-300`}>Your plan says first · {ahead.minutes}</p>
                <p className="mt-1 text-sm font-semibold text-dx-ink">{ahead.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-dx-ink-2">{ahead.reason}</p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-dx-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          )}

          {featured ? (
            <FeaturedCaseCard featured={featured} />
          ) : (
            <div className={`${panel} p-6 text-sm text-dx-ink-2`}>
              No case is published yet.{" "}
              <Link href="/cases" className="font-medium text-blue-700 hover:underline">
                Open the library
              </Link>
            </div>
          )}

          {drill && <DailyDrillStrip drill={drill} />}
          <StreakBanner streak={profile.current_streak} longest={profile.longest_streak} />
          <PracticeTracks tracks={tracks} />
          <PracticeRecord record={record} />
        </div>

        {/* Beside the main column once there is room for both next to the
            app sidebar; below it before that. */}
        <aside className="grid min-w-0 content-start gap-5 md:max-[1359px]:grid-cols-2" aria-label="Insights">
          <div className="md:max-[1359px]:col-span-2">
            <GlobalSearch />
          </div>
          <TargetFirms firms={firms} />
          <ExaminerEvaluation evaluation={evaluation} />
          <PlacementBenchmark benchmark={benchmark} />
          {quota ? <QuotaCard quota={quota} /> : null}
        </aside>
      </div>
    </div>
  );
}
