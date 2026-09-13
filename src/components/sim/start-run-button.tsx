"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function StartRunButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function start() {
    setBusy(true);
    try {
      const response = await fetch("/api/sim/runs", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not start a run.");
        return;
      }
      router.push(`/simulation/${payload.id}`);
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={start} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <Play />}
      Start a run
    </Button>
  );
}
