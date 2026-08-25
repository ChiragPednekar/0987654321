import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, formatNumber } from "@/lib/utils";
import { QUOTA } from "@/lib/constants";
import type { QuotaStatus } from "@/lib/quota";

/**
 * Remaining fair-use allowance.
 *
 * Shown before it runs out, not after. A quota a user discovers by being
 * refused mid-submission is a support ticket; one they can see coming is just
 * a number.
 */
export function QuotaCard({ quota }: { quota: QuotaStatus }) {
  const rows = [
    {
      label: "Graded answers",
      used: quota.gradingsUsed,
      limit: quota.gradingLimit,
      left: quota.gradingsLeft,
    },
    // A free user has no interview allowance at all — showing them 0 of 0
    // reads as a bug rather than as an upsell.
    ...(quota.interviewLimit > 0
      ? [
          {
            label: "Mock interviews",
            used: quota.interviewsUsed,
            limit: quota.interviewLimit,
            left: quota.interviewsLeft,
          },
        ]
      : []),
  ];

  const anyLow = rows.some((r) => r.limit > 0 && r.left / r.limit < 0.15);

  return (
    <Card className={cn(anyLow && "border-amber-500/40")}>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">Your allowance</p>
          <p className="text-xs text-muted-foreground">
            rolling {QUOTA.windowDays} days
          </p>
        </div>

        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="tabular">
                {formatNumber(row.left)} left
                <span className="text-muted-foreground">
                  {" "}of {formatNumber(row.limit)}
                </span>
              </span>
            </div>
            <Progress
              value={row.limit ? (row.used / row.limit) * 100 : 0}
              className="mt-1.5"
            />
          </div>
        ))}

        {!quota.isPro ? (
          <p className="text-xs text-muted-foreground">
            Pro raises this to {formatNumber(QUOTA.pro.gradings)} graded answers
            and {QUOTA.pro.interviews} interviews.{" "}
            <Link href="/pricing" className="underline underline-offset-4">
              See Pro
            </Link>
          </p>
        ) : anyLow ? (
          <p className="text-xs text-muted-foreground">
            Older attempts drop out of the window as they age past{" "}
            {QUOTA.windowDays} days, which frees allowance back up.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
