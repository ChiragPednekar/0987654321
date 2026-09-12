"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Clears one finding, optionally lifting the suspension it contributed to.
 *
 * Reinstating is a second, explicit click rather than something that happens
 * automatically when the last strike is cleared: reopening a suspended account
 * is a decision somebody should make on purpose.
 */
export function IntegrityActions({
  submissionId,
  suspended,
}: {
  submissionId: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function clear(reinstate: boolean) {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/integrity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId, reinstate }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not clear this finding.");
        return;
      }
      toast.success(
        reinstate ? "Finding cleared and account reopened." : "Finding cleared.",
      );
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => clear(false)}>
        {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
        Clear
      </Button>
      {suspended && (
        <Button size="sm" disabled={busy} onClick={() => clear(true)}>
          Clear and reopen account
        </Button>
      )}
    </div>
  );
}
