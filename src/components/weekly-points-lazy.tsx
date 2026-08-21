"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { WeekPoint } from "@/components/weekly-points";

/** Recharts stays out of the initial bundle, as with the other charts. */
const WeeklyPoints = dynamic(
  () => import("@/components/weekly-points").then((m) => m.WeeklyPoints),
  { ssr: false, loading: () => <Skeleton className="h-[220px] w-full rounded-md" /> },
);

export function WeeklyPointsLazy({ data }: { data: WeekPoint[] }) {
  return <WeeklyPoints data={data} />;
}
