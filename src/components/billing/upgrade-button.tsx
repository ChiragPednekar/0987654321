"use client";

import * as React from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Razorpay checkout (spec §16).
 *
 * The modal is Razorpay's own hosted widget, so card details never touch this
 * origin. What comes back is only an order id, a payment id and a signature —
 * all three go to /api/billing/verify, which recomputes the HMAC before
 * anything is granted. Nothing the browser says about the payment is trusted.
 */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function UpgradeButton({
  signedIn,
  alreadyPro,
  email,
  name,
}: {
  signedIn: boolean;
  alreadyPro: boolean;
  email?: string;
  name?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [scriptReady, setScriptReady] = React.useState(false);

  async function checkout() {
    if (!signedIn) {
      router.push("/login?next=/pricing");
      return;
    }
    if (!scriptReady || !window.Razorpay) {
      toast.error("Checkout is still loading — try again in a moment.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST" });
      const order = await response.json();

      if (!response.ok) {
        toast.error(order.error ?? "Could not start checkout.");
        return;
      }

      const razorpay = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "CaseCode",
        description: "Pro — one year",
        prefill: { email, name: name ?? undefined },
        theme: { color: "#6366f1" },
        handler: async (result: Record<string, string>) => {
          const verify = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(result),
          });
          const payload = await verify.json();

          if (!verify.ok) {
            // The webhook is the backstop: if the payment really did go
            // through, it will be reconciled server-side regardless.
            toast.error(
              payload.error ??
                "We could not confirm the payment. If you were charged, it will be applied shortly.",
            );
            return;
          }

          toast.success("You're on Pro.");
          router.refresh();
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      });

      razorpay.open();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (alreadyPro) {
    return (
      <Button className="mt-6 w-full" variant="outline" disabled>
        You&apos;re on Pro
      </Button>
    );
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onReady={() => setScriptReady(true)}
      />
      <Button className="mt-6 w-full" onClick={checkout} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        Upgrade to Pro
      </Button>
    </>
  );
}
