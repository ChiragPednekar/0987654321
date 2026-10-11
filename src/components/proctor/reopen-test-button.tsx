"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Lets the student back into a test the camera ended. */
export function ReopenTestButton({ lockoutId }: { lockoutId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function reopen() {
    setBusy(true);
    try {
      const response = await fetch("/api/proctor/lockout/reopen", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lockout_id: lockoutId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.error ?? "Could not reopen this test.");
        return;
      }
      toast.success("Reopened. The student can start this test again.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={() => void reopen()}>
      {busy ? <Loader2 className="animate-spin" /> : <RotateCcw />}
      Reopen test
    </Button>
  );
}
