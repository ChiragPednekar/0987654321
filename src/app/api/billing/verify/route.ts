import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaymentSignature } from "@/lib/billing/razorpay";

const bodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export const dynamic = "force-dynamic";

/**
 * Confirms a checkout the browser reports as successful (spec §16).
 *
 * The signature is the whole security model: the browser hands over an order
 * id, a payment id and an HMAC that only Razorpay and this server can produce.
 * Without recomputing it, anyone could POST an arbitrary order id and be
 * upgraded. The webhook is the backstop for when the browser never gets here.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const valid = verifyPaymentSignature({
    orderId: body.razorpay_order_id,
    paymentId: body.razorpay_payment_id,
    signature: body.razorpay_signature,
  });

  if (!valid) {
    return NextResponse.json(
      { error: "Payment could not be verified." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // The order must belong to this user. A valid signature proves the payment
  // is real, not that it is theirs — without this check one user could claim
  // another's completed order.
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id, user_id")
    .eq("razorpay_subscription_id", body.razorpay_order_id)
    .maybeSingle();

  if (!subscription || subscription.user_id !== user.id) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const periodEnd = new Date();
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);

  await admin
    .from("subscriptions")
    .update({
      status: "active",
      razorpay_payment_id: body.razorpay_payment_id,
      current_period_end: periodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);

  await admin.from("users").update({ plan: "pro" }).eq("id", user.id);

  return NextResponse.json({ plan: "pro" });
}
