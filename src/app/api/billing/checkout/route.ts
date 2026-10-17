import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createOrder,
  razorpayConfigured,
  PRO_PRICE_PAISE,
  PRO_CURRENCY,
} from "@/lib/billing/razorpay";
import { canRenew, getAccess, RENEWAL_WINDOW_DAYS } from "@/lib/subscription";

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

  // Pro from somewhere other than a subscription — a campus licence that
  // grants it, Pro granted by hand, an admin — needs no payment. A subscriber
  // may renew in the last RENEWAL_WINDOW_DAYS of their period, and the new
  // year is added on top of what is left (see nextPeriodEnd).
  const access = await getAccess(admin, user.id);
  if (access.pro && !access.subscription) {
    return NextResponse.json(
      { error: "Your account already has CaseCode Pro." },
      { status: 409 },
    );
  }
  if (access.subscription && !canRenew(access.subscription.endsAt)) {
    return NextResponse.json(
      {
        error: `Your Pro runs until ${new Date(access.subscription.endsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}. You can renew in the last ${RENEWAL_WINDOW_DAYS} days.`,
      },
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
    source: "razorpay",
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
