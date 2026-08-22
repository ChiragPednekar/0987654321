"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Clock, Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DIFFICULTY_CLASS, DOMAIN_LABEL } from "@/lib/constants";
import { msUntilReset } from "@/lib/daily-case";
import { cn } from "@/lib/utils";
import type { Difficulty, Domain } from "@/lib/types/database";

export interface DailyCase {
  slug: string;
  title: string;
  domain: string;
  difficulty: string;
  estimated_minutes: number;
  ceReward: number;
}

function format(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function DailyCaseCard({
  dailyCase,
  solved,
}: {
  dailyCase: DailyCase;
  solved: boolean;
}) {
  // Rendered on the server too, so the countdown starts from null and fills in
  // after mount — otherwise the server and client disagree on the second and
  // React reports a hydration mismatch.
  const [remaining, setRemaining] = React.useState<number | null>(null);

  React.useEffect(() => {
    setRemaining(msUntilReset());
    const timer = setInterval(() => setRemaining(msUntilReset()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Card className="overflow-hidden border-primary/30 bg-primary/[0.03]">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-[var(--warning)]" />
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              Daily case
            </p>
            {solved && (
              <Badge variant="success" className="text-[10px]">
                Solved today
              </Badge>
            )}
          </div>

          <Link
            href={`/cases/${dailyCase.slug}`}
            className="mt-1.5 block truncate text-lg font-semibold tracking-tight hover:underline"
          >
            {dailyCase.title}
          </Link>

          <div className="mt-2 flex flex-wrap items-center gap-2.5 text-xs">
            <Badge variant="secondary">
              {DOMAIN_LABEL[dailyCase.domain as Domain]}
            </Badge>
            <span
              className={cn(
                "font-medium capitalize",
                DIFFICULTY_CLASS[dailyCase.difficulty as Difficulty],
              )}
            >
              {dailyCase.difficulty}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3" />
              {dailyCase.estimated_minutes} min
            </span>
            <span className="text-muted-foreground">
              +{dailyCase.ceReward} CE
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <p className="text-xs text-muted-foreground">
            Resets in{" "}
            <span className="tabular font-medium text-foreground">
              {remaining === null ? "—" : format(remaining)}
            </span>
          </p>
          <Button asChild>
            <Link href={`/cases/${dailyCase.slug}`}>
              {solved ? "Solve again" : "Solve now"}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
