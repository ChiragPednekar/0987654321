"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Handshake, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function StartNegotiationButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function start() {
    setBusy(true);
    try {
      const response = await fetch("/api/negotiation/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload.error ?? "Could not start.");
        return;
      }
      router.push(`/negotiation/${payload.id}`);
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" className="shrink-0" onClick={start} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : <Handshake />}
      Negotiate
    </Button>
  );
}
