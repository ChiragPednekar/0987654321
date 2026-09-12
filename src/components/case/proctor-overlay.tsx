"use client";

import { Eye, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * What a student sees when they leave the page mid-answer in exam mode.
 *
 * Fixed to the viewport rather than scoped to the editor, deliberately: the
 * thing worth hiding is the case text, not the empty textarea. The page cannot
 * stop them switching to another tab — no web page can — so the deterrent is
 * that the case is not readable while they are there, and coming back costs an
 * acknowledgement that has already been counted.
 *
 * Rendered only after focus returns. While the tab is genuinely hidden nothing
 * is painted anyway, and the browser throttles the timers that would paint it.
 */
export function ProctorOverlay({
  count,
  onResume,
}: {
  count: number;
  onResume: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-6 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="proctor-title"
    >
      <div className="max-w-md space-y-4 rounded-xl border bg-card p-6 text-center shadow-lg">
        <ShieldAlert className="mx-auto size-8 text-[var(--warning,#d97706)]" />
        <h2 id="proctor-title" className="text-lg font-semibold">
          You left the exam window
        </h2>
        <p className="text-sm text-muted-foreground">
          This attempt is proctored. Leaving the page has been recorded and will
          be shown with your submission.
        </p>
        <p className="text-sm font-medium tabular">
          {count === 1 ? "1 interruption" : `${count} interruptions`} so far
        </p>
        <Button onClick={onResume} className="w-full">
          <Eye />
          Resume
        </Button>
      </div>
    </div>
  );
}

/** The quieter practice-mode equivalent: counted, mentioned, not blocking. */
export function ProctorNotice({ count }: { count: number }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-[var(--warning,#d97706)]/30 bg-[var(--warning,#d97706)]/5 p-3 text-xs">
      <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-[var(--warning,#d97706)]" />
      <p className="text-muted-foreground">
        You have left this page{" "}
        <span className="font-medium text-foreground tabular">{count}</span>{" "}
        {count === 1 ? "time" : "times"} while writing. This is recorded with
        your answer.
      </p>
    </div>
  );
}
