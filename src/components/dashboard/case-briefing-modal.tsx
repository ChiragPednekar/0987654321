"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, ScrollText, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeaturedCase } from "@/lib/student-dashboard";
import { dashFonts } from "./fonts";
import { eyebrow } from "./primitives";

/**
 * The briefing before a case: what the problem is, what you must produce, how
 * it is marked and how long to allow. Entering opens the case's own workspace,
 * which runs its usual start-up (camera check, attempt timer) — nothing here
 * starts a session.
 */
export function CaseBriefingModal({
  featured,
  open,
  onOpenChange,
}: {
  featured: FeaturedCase;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const href = `/cases/${featured.slug}`;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "dash-dialog fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-dx-border bg-dx-card text-dx-ink shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            dashFonts,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-dx-border px-6 py-5">
            <div className="min-w-0">
              <p className={`${eyebrow} text-blue-600 dark:text-blue-400`}>Case briefing</p>
              <DialogPrimitive.Title className="dash-display mt-1.5 text-lg font-bold leading-snug tracking-[-0.01em]">
                {featured.title}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-dx-muted transition-colors hover:bg-dx-subtle hover:text-dx-ink"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
          </div>

          <div className="space-y-5 overflow-y-auto px-6 py-5">
            <section>
              <h3 className={`${eyebrow} flex items-center gap-1.5 text-dx-muted`}>
                <ScrollText className="size-3.5" aria-hidden /> The situation
              </h3>
              <DialogPrimitive.Description className="mt-2 text-sm leading-relaxed text-dx-ink-2">
                {featured.briefing}
              </DialogPrimitive.Description>
            </section>

            {featured.objective && (
              <section className="rounded-lg border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
                <h3 className={`${eyebrow} flex items-center gap-1.5 text-blue-700 dark:text-blue-300`}>
                  <Target className="size-3.5" aria-hidden /> Your objective
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-dx-ink">{featured.objective}</p>
              </section>
            )}

            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-dx-border bg-dx-subtle/60 p-3">
                <dt className={`${eyebrow} text-dx-muted`}>Evaluation mode</dt>
                <dd className="mt-1 text-sm font-medium">
                  {featured.criteria.length > 0
                    ? `Rubric-graded · ${featured.criteria.length} criteria`
                    : "Rubric-graded"}
                </dd>
                {featured.maxScore ? (
                  <dd className="dash-mono mt-0.5 text-[11px] text-dx-muted">out of {featured.maxScore} points</dd>
                ) : null}
              </div>
              <div className="rounded-lg border border-dx-border bg-dx-subtle/60 p-3">
                <dt className={`${eyebrow} text-dx-muted`}>Duration</dt>
                <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                  <Clock className="size-3.5 text-dx-muted" aria-hidden /> ~{featured.minutes} min
                </dd>
                <dd className="dash-mono mt-0.5 text-[11px] text-dx-muted">+{featured.ceReward} CE on a solve</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-dx-border bg-dx-subtle/40 px-6 py-4 sm:flex-row sm:justify-end">
            <DialogPrimitive.Close className="h-10 rounded-lg px-4 text-sm font-medium text-dx-ink-2 transition-colors hover:bg-dx-subtle hover:text-dx-ink">
              Dismiss
            </DialogPrimitive.Close>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                router.push(href);
              }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              Enter Practice Workspace <ArrowRight className="size-4" />
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
