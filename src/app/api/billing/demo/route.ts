import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkoutMode } from "@/lib/billing/checkout-mode";
import { activatePaidPeriod, getAccess, purchaseBlock } from "@/lib/subscription";

export const dynamic = "force-dynamic";

/**
 * Demo checkout: the stand-in for Razorpay until the keys exist.
 *
 * No money moves. The student confirms a dummy amount on /upgrade and gets a
 * real subscription period through the same activation a verified payment
 * uses, marked source = 'demo' (migration 070). Refused outright once Razorpay
 * is configured, or when DEMO_CHECKOUT=off, so it cannot outlive its purpose.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (checkoutMode() !== "demo") {
    return NextResponse.json({ error: "Demo checkout is not available." }, { status: 404 });
  }

  const admin = createAdminClient();

  const blocked = purchaseBlock(await getAccess(admin, user.id));
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 });

  const { data: row, error } = await admin
    .from("subscriptions")
    .insert({
      user_id: user.id,
      plan: "pro",
      status: "created",
      source: "demo",
      razorpay_subscription_id: `demo_order_${crypto.randomUUID()}`,
    })
    .select("id")
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "Could not start the subscription." }, { status: 500 });
  }

  const { endsAt } = await activatePaidPeriod(admin, {
    subscriptionId: row.id,
    userId: user.id,
    paymentId: `demo_pay_${crypto.randomUUID()}`,
  });

  return NextResponse.json({ plan: "pro", ends_at: endsAt });
}
