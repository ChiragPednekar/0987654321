"use client";

import * as React from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CheckoutMode } from "@/lib/billing/checkout-mode";

/**
 * Razorpay checkout for individual CaseCode Pro subscription (spec §16).
 *
 * Card and payment details never touch this origin; they are securely handled
 * inside Razorpay's hosted checkout widget. On completion, the order id,
 * payment id, and cryptographic HMAC signature are verified by /api/billing/verify
 * before Pro access is granted.
 *
 * Until Razorpay is connected the deployment runs a demo checkout instead
 * (src/lib/billing/checkout-mode.ts): the button goes to /upgrade, which shows
 * the amount and opens the subscription without taking money.
 */

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export interface UpgradeButtonProps {
  signedIn: boolean;
  alreadyPro?: boolean;
  /**
   * How this deployment takes payment, read on the server (checkoutMode) and
   * passed down so the button never offers a checkout the route will refuse.
   */
  mode: CheckoutMode;
  email?: string;
  name?: string | null;
  label?: string;
  variant?: "default" | "outline" | "ink" | "secondary";
  size?: "default" | "sm" | "lg";
  className?: string;
  onSuccess?: () => void;
}

export function UpgradeButton({
  signedIn,
  alreadyPro = false,
  mode,
  email,
  name,
  label = "Upgrade to Pro — ₹499/yr",
  variant = "default",
  size = "default",
  className,
  onSuccess,
}: UpgradeButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [scriptReady, setScriptReady] = React.useState(false);

  async function checkout() {
    if (!signedIn) {
      router.push("/login?next=/pricing");
      return;
    }

    if (!scriptReady || !window.Razorpay) {
      toast.error("Checkout gateway is initializing — please try again in a moment.");
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
        description: "CaseCode Pro — 1 Year Subscription",
        prefill: { email, name: name ?? undefined },
        theme: { color: "#1f5566" },
        handler: async (result: Record<string, string>) => {
          try {
            const verify = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(result),
            });
            const payload = await verify.json();

            if (!verify.ok) {
              toast.error(
                payload.error ??
                  "Could not verify payment immediately. If you were charged, your account will be upgraded shortly via webhook.",
              );
              return;
            }

            toast.success("Welcome to CaseCode Pro! All case solving and AI features are now unlocked.");
            onSuccess?.();
            router.refresh();
          } catch {
            toast.error("Failed to verify payment confirmation.");
          }
        },
        modal: {
          ondismiss: () => setBusy(false),
        },
      });

      razorpay.open();
    } catch {
      toast.error("Network error while reaching payment server.");
    } finally {
      setBusy(false);
    }
  }

  if (alreadyPro) {
    return (
      <Button className={className} variant="outline" size={size} disabled>
        <Sparkles className="mr-1.5 size-3.5 text-primary" />
        Current Plan: Pro
      </Button>
    );
  }

  if (mode === "demo") {
    return (
      <Button className={className} variant={variant} size={size} asChild>
        <Link href={signedIn ? "/upgrade" : "/login?next=/upgrade"}>
          <Sparkles className="mr-1.5 size-3.5" />
          {label}
        </Link>
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
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onReady={() => setScriptReady(true)}
      />
      <Button
        className={className}
        variant={variant}
        size={size}
        onClick={checkout}
        disabled={busy}
      >
        {busy ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Sparkles className="mr-1.5 size-3.5" />}
        {busy ? "Starting checkout…" : label}
      </Button>
    </>
  );
}
