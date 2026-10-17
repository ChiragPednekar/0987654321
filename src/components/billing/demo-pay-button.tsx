"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * The "pay" step of the demo checkout (/upgrade). Posts to /api/billing/demo,
 * which opens the subscription period; the page then re-renders as Pro.
 */
export function DemoPayButton({ amountLabel }: { amountLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function pay() {
    setBusy(true);
    try {
      const response = await fetch("/api/billing/demo", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.error ?? "Could not complete the payment.");
        return;
      }
      toast.success("Payment received — CaseCode Pro is on.");
      router.refresh();
    } catch {
      toast.error("Network error — nothing was charged. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="ink" size="lg" className="w-full" onClick={pay} disabled={busy}>
      {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
      {busy ? "Processing…" : `Pay ${amountLabel}`}
    </Button>
  );
}
