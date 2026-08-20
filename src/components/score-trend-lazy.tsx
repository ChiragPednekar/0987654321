"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { TrendPoint } from "@/components/score-trend";

/**
 * Same reasoning as the skill radar: Recharts is heavy, and the chart sits
 * below the summary tiles. Loading it on the client keeps it out of the
 * initial bundle.
 */
const ScoreTrend = dynamic(
  () => import("@/components/score-trend").then((m) => m.ScoreTrend),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[260px] w-full rounded-md" />,
  },
);

export function ScoreTrendLazy({ data }: { data: TrendPoint[] }) {
  return <ScoreTrend data={data} />;
}
