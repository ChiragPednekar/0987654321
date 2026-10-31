import Link from "next/link";
import { cn, timeAgo } from "@/lib/utils";
import type { ActivityType } from "@/lib/types/database";
import type { PracticeRecord as Record8Weeks } from "@/lib/student-dashboard";
import { SkillRadarLazy } from "@/components/skill-radar-lazy";
import { SubmissionHeatmap } from "@/components/submission-heatmap";
import { WeeklyPointsLazy } from "@/components/weekly-points-lazy";
import { eyebrow, panel } from "./primitives";

const ACTIVITY_COPY: Record<ActivityType, string> = {
  case_solved: "Solved",
  case_attempted: "Attempted",
  badge_earned: "Earned a badge",
  level_up: "Levelled up",
  contest_entered: "Entered a contest",
  path_step_completed: "Completed a path step",
};

function Block({ title, note, className, children }: { title: string; note?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn(panel, "min-w-0 p-5", className)}>
      <h3 className="dash-display text-[15px] font-bold text-dx-ink">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-dx-ink-2">{note}</p>}
      <div className="mt-3 min-w-0">{children}</div>
    </section>
  );
}

/** The last eight weeks: points, every day, skill shape and recent activity. */
export function PracticeRecord({ record }: { record: Record8Weeks }) {
  return (
    <section aria-labelledby="record-heading">
      <h2 id="record-heading" className="dash-display text-lg font-bold tracking-[-0.01em] text-dx-ink">
        Your practice record
      </h2>
      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
        <Block title="Points by week" note="Last 8 weeks. Points come from graded cases.">
          <WeeklyPointsLazy data={record.weekly} />
        </Block>
        <Block title="Every day" note="One square a day. Consistency beats intensity.">
          <SubmissionHeatmap counts={record.heatmap} />
        </Block>
        <Block title="Skill radar" note="Average score by domain. The dents are your homework.">
          <SkillRadarLazy data={record.radar} />
        </Block>
        <Block title="Recent activity">
          {record.activity.length > 0 ? (
            <ul className="divide-y divide-dx-border">
              {record.activity.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                  <p className="min-w-0 truncate">
                    <span className="text-dx-muted">{ACTIVITY_COPY[item.type]}</span>{" "}
                    {item.caseRef ? (
                      <Link href={`/cases/${item.caseRef.slug}`} className="font-medium text-dx-ink hover:underline">
                        {item.caseRef.title}
                      </Link>
                    ) : (
                      <span className="font-medium text-dx-ink">{item.label}</span>
                    )}
                  </p>
                  <span className={`${eyebrow} shrink-0 normal-case tracking-normal text-dx-muted`}>
                    {item.ceDelta > 0 && <span className="mr-2 text-dx-ink">+{item.ceDelta}</span>}
                    {timeAgo(item.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-dx-ink-2">Nothing here yet. Solve a case and it&apos;ll show up.</p>
          )}
        </Block>
      </div>
    </section>
  );
}
