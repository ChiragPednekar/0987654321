import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { activatePaidPeriod } from "@/lib/subscription";

export const dynamic = "force-dynamic";

/**
 * Razorpay webhook (spec §16).
 *
 * Unauthenticated by necessity — Razorpay has no session — so the signature is
 * the only thing standing between this endpoint and anyone on the internet
 * granting themselves Pro. The raw body must be hashed exactly as received,
 * which is why this reads text() and parses afterwards rather than using
 * request.json().
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!signature || !verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: { entity?: { order_id?: string; id?: string } };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Malformed body" }, { status: 400 });
  }

  const entity = event.payload?.payment?.entity;
  const orderId = entity?.order_id;

  if (!orderId) {
    // Nothing to reconcile, but the signature was valid — 200 so Razorpay does
    // not retry an event we simply do not act on.
    return NextResponse.json({ ok: true, ignored: event.event ?? null });
  }

  const admin = createAdminClient();

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id, user_id")
    .eq("razorpay_subscription_id", orderId)
    .maybeSingle();

  if (!subscription) {
    return NextResponse.json({ ok: true, ignored: "unknown order" });
  }

  const captured =
    event.event === "payment.captured" || event.event === "order.paid";

  if (captured) {
    // Same activation as /api/billing/verify; only the first one counts.
    await activatePaidPeriod(admin, {
      subscriptionId: subscription.id,
      userId: subscription.user_id,
      paymentId: entity?.id ?? null,
    });
  } else if (event.event === "payment.failed") {
    // Never downgrade a period that is already paid and active.
    await admin
      .from("subscriptions")
      .update({ status: "halted", updated_at: new Date().toISOString() })
      .eq("id", subscription.id)
      .neq("status", "active");
  }

  return NextResponse.json({ ok: true });
}
