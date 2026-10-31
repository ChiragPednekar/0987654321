"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import type { WeekPoint } from "@/components/weekly-points";

/** Recharts stays out of the initial bundle, as with the other charts. */
const WeeklyPoints = dynamic(
  () => import("@/components/weekly-points").then((m) => m.WeeklyPoints),
  { ssr: false, loading: () => <Skeleton className="h-[220px] w-full rounded-md" /> },
);

export function WeeklyPointsLazy({ data }: { data: WeekPoint[] }) {
  if (data.every((week) => week.points === 0)) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center gap-2 px-3 text-center">
        <p className="text-sm text-dx-ink-2">Solve a case to start earning points.</p>
        <Link href="/cases" className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">
          Browse cases
        </Link>
      </div>
    );
  }
  return <WeeklyPoints data={data} />;
}
