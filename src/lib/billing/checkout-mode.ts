import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { razorpayConfigured } from "@/lib/billing/razorpay";
import type { Database } from "@/lib/types/database";

/**
 * How this deployment takes money.
 *
 *   razorpay — the real checkout; chosen as soon as the keys exist.
 *   demo     — the pay step "charges" a dummy amount and fulfils the purchase
 *              (source = 'demo'), so every paid flow can be used before
 *              Razorpay is connected. No money moves.
 *   closed   — neither; set DEMO_CHECKOUT=off to stop the demo without
 *              switching Razorpay on.
 *
 * Read on the server and passed to the client, so a button never offers a
 * checkout the route behind it will refuse.
 */
export type CheckoutMode = "razorpay" | "demo" | "closed";

export function checkoutMode(): CheckoutMode {
  if (razorpayConfigured()) return "razorpay";
  return process.env.DEMO_CHECKOUT === "off" ? "closed" : "demo";
}

/**
 * The checkout one account gets.
 *
 * Sign-up is open (071), so on production a demo checkout open to everyone
 * would hand any stranger free Pro — real model spend. There it is limited to
 * the testers on access_allowlist and to admins; everyone else sees payments
 * as not open yet until Razorpay is connected. Local development keeps the
 * demo open to every account.
 */
export async function checkoutModeFor(
  admin: SupabaseClient<Database>,
  user: { id: string; email?: string | null },
): Promise<CheckoutMode> {
  const mode = checkoutMode();
  if (mode !== "demo" || process.env.NODE_ENV !== "production") return mode;

  const [listed, profile] = await Promise.all([
    user.email
      ? admin.from("access_allowlist").select("email").eq("email", user.email.toLowerCase()).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from("users").select("role").eq("id", user.id).maybeSingle(),
  ]);
  return listed.data || profile.data?.role === "admin" ? "demo" : "closed";
}
