"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Opens a room and drops the host straight into it. */
export function OpenGdForm() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [joinPolicy, setJoinPolicy] = React.useState<"open" | "approval">("open");

  async function open() {
    setBusy(true);
    try {
      const response = await fetch("/api/gd/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ join_policy: joinPolicy }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not open a room.");
        return;
      }
      router.push(`/gd/${payload.id}`);
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs text-muted-foreground">
        Who can join
        <select
          value={joinPolicy}
          onChange={(event) => setJoinPolicy(event.target.value as "open" | "approval")}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        >
          <option value="open">Anyone with the link</option>
          <option value="approval">Request to join</option>
        </select>
      </label>
      <Button onClick={open} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Users />}
        Start a discussion
      </Button>
    </div>
  );
}
