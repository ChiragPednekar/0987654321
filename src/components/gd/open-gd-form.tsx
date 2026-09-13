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

  async function open() {
    setBusy(true);
    try {
      const response = await fetch("/api/gd/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
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
    <Button onClick={open} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <Users />}
      Open a room
    </Button>
  );
}
