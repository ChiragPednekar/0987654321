"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PullToggle({ questionId, pulled }: { questionId: string; pulled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function toggle() {
    if (!pulled && !window.confirm("Pull this question? It stops counting for every student, including those who already answered.")) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/current-affairs/pull", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question_id: questionId, pulled: !pulled }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not update.");
        return;
      }
      toast.success(pulled ? "Restored." : "Pulled.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant={pulled ? "outline" : "destructive"} onClick={toggle} disabled={busy}>
      {busy && <Loader2 className="animate-spin" />}
      {pulled ? "Restore" : "Pull"}
    </Button>
  );
}
