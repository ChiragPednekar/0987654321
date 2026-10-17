import "server-only";

import { razorpayConfigured } from "@/lib/billing/razorpay";

/**
 * How this deployment takes money for CaseCode Pro.
 *
 *   razorpay — the real checkout; chosen as soon as the keys exist.
 *   demo     — /upgrade "charges" a dummy amount and opens a real
 *              subscription period (source = 'demo', migration 070), so the
 *              subscribe flow can be used before Razorpay is connected.
 *   closed   — neither; set DEMO_CHECKOUT=off to stop handing out demo Pro
 *              without switching Razorpay on.
 *
 * Read on the server and passed to the client, so a button never offers a
 * checkout the route behind it will refuse.
 */
export type CheckoutMode = "razorpay" | "demo" | "closed";

export function checkoutMode(): CheckoutMode {
  if (razorpayConfigured()) return "razorpay";
  return process.env.DEMO_CHECKOUT === "off" ? "closed" : "demo";
}
