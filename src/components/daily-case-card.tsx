"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DOMAIN_LABEL } from "@/lib/constants";
import { msUntilReset } from "@/lib/daily-case";
import type { Domain } from "@/lib/types/database";
import { useTicking } from "@/hooks/use-browser-state";

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
  // Rendered on the server too, so the countdown is null until hydration —
  // otherwise the server and client disagree on the second and React reports
  // a mismatch. Read in whole seconds, so it changes once per tick.
  const seconds = useTicking<number | null>(() => Math.floor(msUntilReset() / 1000), 1000, null);
  const remaining = seconds === null ? null : seconds * 1000;

  // An editorial band rather than a card: the case title in the serif,
  // the facts in small mono, and one ink action.
  return (
    <section className="border-y border-border py-7">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Today&apos;s case
            {solved && <span className="ml-3 text-success">· solved</span>}
          </p>
          <Link
            href={`/cases/${dailyCase.slug}`}
            className="mt-3 block font-editorial text-[1.9rem] leading-[1.1] tracking-[-0.01em] hover:italic sm:text-[2.4rem]"
          >
            {dailyCase.title}
          </Link>
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            {DOMAIN_LABEL[dailyCase.domain as Domain]} · {dailyCase.difficulty} ·{" "}
            {dailyCase.estimated_minutes} min · +{dailyCase.ceReward} CE
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
          <p className="font-mono text-xs text-muted-foreground">
            resets in{" "}
            <span className="tabular text-foreground">
              {remaining === null ? "—" : format(remaining)}
            </span>
          </p>
          <Button variant="ink" size="lg" asChild>
            <Link href={`/cases/${dailyCase.slug}`}>
              {solved ? "Solve again" : "Solve now"}
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
