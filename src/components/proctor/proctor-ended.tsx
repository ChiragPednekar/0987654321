"use client";

import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEndedTest } from "@/hooks/proctor-ended-store";
import { END_REASON_LABEL } from "@/lib/camera-proctor";

/**
 * What a student sees once the camera has ended their test.
 *
 * Covers the whole viewport, above everything including the interruption
 * overlay, so the answer underneath can be neither read nor changed. It has no
 * way back into the test: the only control leaves the page. Reloading brings
 * this screen back, because the ending is stored — see
 * /api/proctor/lockout — until a teacher or the admin reopens it.
 *
 * Mounted once, in the root layout. useProctor decides when it shows.
 */
export function ProctorEndedHost() {
  const ended = useEndedTest();
  if (!ended) return null;

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
        <p className="text-sm text-muted-foreground">
          You can no longer write or change your answer. What the camera saw
          has been recorded, with a photo where one could be taken, for your
          teacher to review. If this was a mistake, ask your teacher to reopen
          the test.
        </p>
        <Button asChild className="w-full">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
