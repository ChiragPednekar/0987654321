"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEndedTest, type EndedTest } from "@/hooks/proctor-ended-store";
import { END_REASON_LABEL } from "@/lib/camera-proctor";

/**
 * What a student sees once their test has been ended — by the camera, or by
 * leaving the test window.
 *
 * Covers the whole viewport, above everything including the interruption
 * overlay, so the answer underneath can be neither read nor changed. It has no
 * way back into the test: the only control leaves the page. Reloading brings
 * this screen back, because the ending is stored — see
 * /api/proctor/lockout. It lifts by itself after 24 hours, the third time
 * for good; a teacher or the admin can reopen it sooner.
 *
 * Mounted once, in the root layout. useProctor decides when it shows.
 */
export function ProctorEndedHost() {
  const ended = useEndedTest();
  const pathname = usePathname();
  // Group discussions are collaborative meetings and never enforce test
  // lockouts, including stale lockouts raised on another assessment page.
  if (!ended || pathname === "/gd" || pathname.startsWith("/gd/")) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="proctor-ended-title"
      aria-describedby="proctor-ended-reason"
    >
      <div className="max-w-md space-y-4 rounded-xl border border-danger-border bg-card p-6 text-center shadow-lg">
        <ShieldX className="mx-auto size-8 text-danger" aria-hidden />
        <h2 id="proctor-ended-title" className="text-lg font-semibold">
          This test has ended
        </h2>
        <p id="proctor-ended-reason" className="text-sm font-medium">
          {END_REASON_LABEL[ended.reason]}.
        </p>
        <Retry ended={ended} />
        <p className="text-sm text-muted-foreground">
          What happened has been recorded for your teacher to review, with a
          camera photo where one could be taken. If this was a mistake, ask
          your teacher to reopen the test.
        </p>
        <Button asChild className="w-full">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

function Retry({ ended }: { ended: EndedTest }) {
  // Not yet heard back from the server: say only what is certain.
  if (ended.until === undefined) {
    return (
      <p className="text-sm text-muted-foreground">
        You can no longer write or change your answer.
      </p>
    );
  }
  const max = ended.maxStrikes ?? 3;
  if (ended.until === null) {
    return (
      <p className="rounded-md bg-danger-surface px-3 py-2 text-sm text-danger">
        This question has now been flagged {max} times, so it is blocked for
        good.
      </p>
    );
  }
  const left = max - (ended.strike ?? 1);
  return (
    <p className="rounded-md bg-muted px-3 py-2 text-sm">
      Blocked for 24 hours. You can try this question again from{" "}
      <span className="font-medium">
        {new Date(ended.until).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </span>
      , under the same rules.{" "}
      {left === 1
        ? "One more flag on this question will block it for good."
        : `${left} more flags on this question will block it for good.`}
    </p>
  );
}
