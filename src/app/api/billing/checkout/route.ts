import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createOrder,
  razorpayConfigured,
  PRO_PRICE_PAISE,
  PRO_CURRENCY,
} from "@/lib/billing/razorpay";

export const dynamic = "force-dynamic";

/** Opens a Razorpay order for Pro (spec §16). */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!razorpayConfigured()) {
    return NextResponse.json(
      { error: "Payments are not configured on this deployment." },
      { status: 503 },
    );
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("users")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.plan === "pro") {
    return NextResponse.json(
      { error: "You are already on Pro." },
      { status: 409 },
    );
  }

  let order;
  try {
    order = await createOrder(`cc_${user.id.replace(/-/g, "").slice(0, 24)}`);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not start checkout.",
      },
      { status: 502 },
    );
  }

  // Recorded as `created` before the browser opens the modal, so a payment
  // that succeeds while the user closes the tab still has a row for the
  // webhook to reconcile against.
  await admin.from("subscriptions").insert({
    user_id: user.id,
    plan: "pro",
    status: "created",
    razorpay_subscription_id: order.id,
  });

  return NextResponse.json({
    order_id: order.id,
    amount: PRO_PRICE_PAISE,
    currency: PRO_CURRENCY,
    // Publishable by design — it identifies the merchant, it does not authorise
    // anything. The secret never leaves the server.
    key_id: process.env.RAZORPAY_KEY_ID,
  });
}
