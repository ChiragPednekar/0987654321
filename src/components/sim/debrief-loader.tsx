"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Fetches the debrief once the run is over.
 *
 * Triggered from the client rather than written when the last quarter is
 * played, so a slow or rate-limited model call never blocks the student from
 * seeing their results. The numbers are already on screen; the commentary
 * arrives when it arrives, and can be retried without replaying anything.
 */
export function DebriefLoader({ runId }: { runId: string }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(true);
  const started = React.useRef(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/sim/runs/${runId}/debrief`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Could not write the debrief.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }, [runId, router]);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    void load();
  }, [load]);

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        {busy ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Reading your eight quarters…
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {error ?? "The debrief is not ready."}
            </p>
            <Button size="sm" variant="outline" onClick={load}>
              Try again
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
