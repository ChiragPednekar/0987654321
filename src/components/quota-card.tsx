import Link from "next/link";
import { Section } from "@/components/section";
import { Progress } from "@/components/ui/progress";
import { cn, formatDay, formatNumber } from "@/lib/utils";
import { QUOTA } from "@/lib/constants";
import { USAGE_WINDOW, PLANS } from "@/lib/pricing";
import type { QuotaStatus } from "@/lib/quota";

/**
 * What an account may still use: the plan's allowance, the 5-hour window and
 * any top-up credits.
 *
 * Shown before it runs out, not after. A limit a student discovers by being
 * refused mid-submission is a support ticket; one they can see coming is just
 * a number.
 */
export function QuotaCard({ quota, title = "Your allowance" }: { quota: QuotaStatus; title?: string }) {
  const rows = [
    { label: "Graded answers", used: quota.gradingsUsed, limit: quota.gradingLimit },
    // A free user has no interview allowance at all — showing them 0 of 0
    // reads as a bug rather than as an upsell.
    ...(quota.interviewLimit > 0
      ? [{ label: "Mock interviews", used: quota.interviewsUsed, limit: quota.interviewLimit }]
      : []),
  ];

  const anyLow = rows.some((r) => r.limit > 0 && (r.limit - r.used) / r.limit < 0.15);
  const periodNote = quota.plan
    ? `this week · ${PLANS[quota.plan].name} until ${quota.periodEndsAt ? formatDay(quota.periodEndsAt) : ""}`
    : `rolling ${QUOTA.windowDays} days`;

  const windowRows = [
    { label: "answers", used: quota.window.gradingsUsed, limit: quota.window.gradingLimit },
    { label: "interviews", used: quota.window.interviewsUsed, limit: quota.window.interviewLimit },
  ];
  const windowFull = windowRows.some((r) => r.used >= r.limit);
  const hasTopups = quota.topups.gradings > 0 || quota.topups.interviews > 0;

  if (quota.exempt) {
    return (
      <Section title={title} action={<span className="font-mono text-xs text-muted-foreground">unlimited</span>}>
        <p className="pt-4 text-sm text-muted-foreground">
          This account has complimentary access: every premium feature, with no allowance or 5-hour limit.
        </p>
      </Section>
    );
  }

  return (
    <Section
      title={title}
      action={
        <span className={cn("font-mono text-xs", anyLow ? "text-warning" : "text-muted-foreground")}>{periodNote}</span>
      }
    >
      <div className="space-y-4 pt-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-mono tabular">
                {formatNumber(Math.max(0, row.limit - row.used))} left
                <span className="text-muted-foreground"> of {formatNumber(row.limit)}</span>
              </span>
            </div>
            <Progress value={row.limit ? (row.used / row.limit) * 100 : 0} className="mt-1.5" />
          </div>
        ))}

        {quota.isPro && !quota.exempt && (
          <div className="border-t border-border pt-3 text-xs">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-muted-foreground">{quota.window.hours}-hour limit</span>
              <span className="font-mono tabular">
                {windowRows.map((r, i) => (
                  <span key={r.label} className={cn(r.used >= r.limit && "text-warning")}>
                    {i > 0 && " · "}
                    {r.used}/{r.limit} {r.label}
                  </span>
                ))}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">
              {quota.window.resetsAt
                ? `Resets at ${new Date(quota.window.resetsAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}.`
                : `A window opens with your next answer or interview and resets ${quota.window.hours} hours later.`}
              {windowFull && !hasTopups ? " Top-ups keep working past this limit." : ""}
            </p>
          </div>
        )}

        {hasTopups && (
          <p className="border-t border-border pt-3 text-xs">
            <span className="text-muted-foreground">Top-up credits: </span>
            <span className="font-mono tabular">
              {quota.topups.gradings} answers · {quota.topups.interviews} interviews
            </span>
            <span className="text-muted-foreground"> — used when the plan or the 5-hour limit runs out.</span>
          </p>
        )}

        {!quota.isPro ? (
          <p className="text-xs text-muted-foreground">
            CaseCode Pro gives you {formatNumber(USAGE_WINDOW.gradings)} graded answers and{" "}
            {USAGE_WINDOW.interviews} interviews every {USAGE_WINDOW.hours} hours, up to{" "}
            {PLANS.monthly.weeklyGradings} answers and {PLANS.monthly.weeklyInterviews} interviews a week.{" "}
            <Link href="/upgrade" className="underline underline-offset-4 hover:text-foreground">
              Upgrade
            </Link>
          </p>
        ) : anyLow || windowFull ? (
          <p className="text-xs text-muted-foreground">
            Running low?{" "}
            <Link href="/upgrade#topups" className="underline underline-offset-4 hover:text-foreground">
              Buy a top-up pack
            </Link>
          </p>
        ) : null}
      </div>
    </Section>
  );
}
