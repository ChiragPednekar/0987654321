"use client";

import * as React from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CheckoutMode } from "@/lib/billing/checkout-mode";

/**
 * The pay button for anything CaseCode sells: a plan, a top-up pack, a
 * certificate exam attempt or an expert mock interview.
 *
 * It names the item; the server prices it (src/lib/billing/purchases.ts).
 * With Razorpay connected, card details go to Razorpay's hosted widget and
 * never touch this origin, and /api/billing/verify checks the signature
 * before anything is delivered. With the demo checkout the purchase completes
 * at once without taking money. Either way the student lands on the receipt.
 */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export type CheckoutItem =
  | { kind: "plan"; code: "monthly" | "season" | "annual" }
  | { kind: "topup"; code: "answers_25" | "interviews_10" | "combo" }
  | { kind: "exam"; slug: string }
  | { kind: "expert_session"; slotId: string; notes?: string };

export interface CheckoutButtonProps {
  item: CheckoutItem;
  mode: CheckoutMode;
  signedIn: boolean;
  label: string;
  /** Where to come back to after signing in. */
  loginNext?: string;
  email?: string;
  name?: string | null;
  variant?: "default" | "outline" | "ink" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
  disabled?: boolean;
}

export function CheckoutButton({
  item,
  mode,
  signedIn,
  label,
  loginNext = "/pricing",
  email,
  name,
  variant = "ink",
  size = "default",
  className,
  disabled,
}: CheckoutButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [scriptReady, setScriptReady] = React.useState(false);

  async function pay() {
    if (mode === "razorpay" && (!scriptReady || !window.Razorpay)) {
      toast.error("The payment window is still loading — try again in a moment.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item),
      });
      const order = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(order.error ?? "Could not start the payment.");
        setBusy(false);
        return;
      }

      if (order.mode === "demo") {
        toast.success("Payment received.");
        router.push(order.redirect);
        return;
      }

      const razorpay = new window.Razorpay!({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "CaseCode",
        description: order.description,
        prefill: { email, name: name ?? undefined },
        theme: { color: "#111111" },
        handler: async (result: Record<string, string>) => {
          try {
            const verify = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(result),
            });
            const payload = await verify.json().catch(() => ({}));
            if (!verify.ok) {
              toast.error(
                payload.error ??
                  "We could not confirm the payment yet. If you were charged, it will be applied within a few minutes.",
              );
              return;
            }
            toast.success("Payment received.");
            router.push(payload.redirect ?? order.redirect);
          } catch {
            toast.error("Could not confirm the payment. If you were charged, it will be applied shortly.");
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      razorpay.open();
    } catch {
      toast.error("Network error — nothing was charged. Try again.");
      setBusy(false);
    }
  }

  if (!signedIn) {
    return (
      <Button className={className} variant={variant} size={size} asChild>
        <Link href={`/login?next=${encodeURIComponent(loginNext)}`}>{label}</Link>
      </Button>
    );
  }

  if (mode === "closed") {
    return (
      <Button className={className} variant="outline" size={size} disabled>
        Payments open soon
      </Button>
    );
  }

  return (
    <>
      {mode === "razorpay" && (
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
          onReady={() => setScriptReady(true)}
        />
      )}
      <Button className={className} variant={variant} size={size} onClick={pay} disabled={busy || disabled}>
        {busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
        {busy ? "Processing…" : label}
      </Button>
    </>
  );
}
