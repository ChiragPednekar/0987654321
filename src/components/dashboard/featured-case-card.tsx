"use client";

import * as React from "react";
import { Bookmark, BookmarkCheck, Clock, Loader2, Play, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DOMAIN_LABEL } from "@/lib/constants";
import type { FeaturedCase } from "@/lib/student-dashboard";
import { CaseBriefingModal } from "./case-briefing-modal";
import { IsometricIllustration } from "./isometric-illustration";
import { DifficultyMeter, criterionLabel, eyebrow, panel } from "./primitives";

/**
 * The one case the dashboard puts first. Start opens the briefing; Save for
 * Mock writes a bookmark (the saved-cases list on /bookmarks) and can be undone.
 */
export function FeaturedCaseCard({ featured }: { featured: FeaturedCase }) {
  const [briefingOpen, setBriefingOpen] = React.useState(false);
  const [saved, setSaved] = React.useState(featured.saved);
  const [saving, setSaving] = React.useState(false);

  async function toggleSaved() {
    if (saving) return;
    const next = !saved;
    setSaving(true);
    try {
      const response = await fetch("/api/bookmarks", {
        method: next ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ case_id: featured.id }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        toast.error(payload.error ?? "Could not update your saved cases.");
        return;
      }
      setSaved(next);
      toast.success(next ? "Saved for mock practice — find it under Bookmarks." : "Removed from saved cases.");
    } catch {
      toast.error("Network error — nothing was saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={cn(panel, "relative overflow-hidden")}>
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-gradient-to-l from-blue-50/80 to-transparent dark:from-blue-500/5 lg:block" aria-hidden />
      <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_210px] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-dx-ink-2">
            <span className={`${eyebrow} rounded-md bg-blue-600 px-2 py-1 text-white`}>Up next</span>
            <span className="font-medium text-dx-ink">{DOMAIN_LABEL[featured.domain]}</span>
            <span className="text-dx-border" aria-hidden>•</span>
            <DifficultyMeter difficulty={featured.difficulty} className="text-blue-700 dark:text-blue-300" />
            <span className="text-dx-border" aria-hidden>•</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5 text-dx-muted" aria-hidden />
              <span className="dash-mono">{featured.minutes} min</span>
            </span>
            <span className="dash-mono inline-flex items-center gap-1 rounded-md bg-orange-50 px-1.5 py-0.5 font-medium text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
              <Zap className="size-3" aria-hidden />+{featured.ceReward} CE
            </span>
          </div>

          <h2 className="dash-display mt-3 text-xl font-bold leading-snug tracking-[-0.015em] text-dx-ink sm:text-[22px]">
            {featured.title}
          </h2>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-dx-ink-2">{featured.description}</p>

          {featured.criteria.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Evaluation rubric">
              {featured.criteria.slice(0, 4).map((criterion) => (
                <li
                  key={criterion.key}
                  className="dash-mono rounded-md border border-dx-border bg-dx-subtle px-2 py-1 text-[11px] text-dx-ink-2"
                >
                  {criterionLabel(criterion.key)}
                  <span className="ml-1 text-dx-muted">/{criterion.max}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-xs text-dx-muted">{featured.reason}</p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setBriefingOpen(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700"
            >
              <Play className="size-4" aria-hidden /> Start Case Interview
            </button>
            <button
              type="button"
              onClick={toggleSaved}
              disabled={saving}
              aria-pressed={saved}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-5 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-70",
                saved
                  ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                  : "border-dx-border bg-dx-card text-dx-ink hover:bg-dx-hover",
              )}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : saved ? (
                <BookmarkCheck className="size-4" aria-hidden />
              ) : (
                <Bookmark className="size-4" aria-hidden />
              )}
              {saved ? "Saved for Mock" : "Save for Mock"}
            </button>
          </div>
        </div>

        <IsometricIllustration className="mx-auto hidden h-auto w-full max-w-[210px] lg:block" />
      </div>

      <CaseBriefingModal featured={featured} open={briefingOpen} onOpenChange={setBriefingOpen} />
    </article>
  );
}
