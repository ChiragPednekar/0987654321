"use client";

import dynamic from "next/dynamic";
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
  return <SkillRadar data={data} />;
}
