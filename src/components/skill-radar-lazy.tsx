"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import type { SkillPoint } from "@/components/skill-radar";

/**
 * Recharts is by far the heaviest thing the dashboard pulls in, and the radar
 * sits below the stat cards. Loading it on the client, after the page is
 * interactive, keeps it out of the initial bundle.
 */
const SkillRadar = dynamic(
  () => import("@/components/skill-radar").then((m) => m.SkillRadar),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[280px] w-full rounded-md" />,
  },
);

export function SkillRadarLazy({ data }: { data: SkillPoint[] }) {
  if (data.every((point) => point.score === 0)) {
    return (
      <div className="flex min-h-32 flex-col items-center justify-center gap-2 px-3 text-center">
        <p className="text-sm text-dx-ink-2">Solve a case in any domain to start your radar.</p>
        <Link href="/cases" className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">
          Browse cases
        </Link>
      </div>
    );
  }
  return <SkillRadar data={data} />;
}
