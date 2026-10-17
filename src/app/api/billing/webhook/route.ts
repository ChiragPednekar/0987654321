import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import { fulfilPurchase } from "@/lib/billing/purchases";

export const dynamic = "force-dynamic";

/**
 * Razorpay webhook (spec §16).
 *
 * Unauthenticated by necessity — Razorpay has no session — so the signature is
 * the only thing standing between this endpoint and anyone on the internet
 * crediting themselves a purchase. The raw body must be hashed exactly as received,
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

  const { data: purchase } = await admin
    .from("purchases")
    .select("id")
    .eq("razorpay_order_id", orderId)
    .maybeSingle();

  if (!purchase) {
    return NextResponse.json({ ok: true, ignored: "unknown order" });
  }

  const captured =
    event.event === "payment.captured" || event.event === "order.paid";

  if (captured) {
    // Same fulfilment as /api/billing/verify; only the first one counts.
    await fulfilPurchase(admin, purchase.id, entity?.id ?? null);
  } else if (event.event === "payment.failed") {
    // Never mark failed a purchase that is already paid.
    await admin
      .from("purchases")
      .update({ status: "failed" })
      .eq("id", purchase.id)
      .eq("status", "created");
  }

  return NextResponse.json({ ok: true });
}
