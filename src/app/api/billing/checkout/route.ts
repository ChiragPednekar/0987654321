import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createOrder, CURRENCY } from "@/lib/billing/razorpay";
import { checkoutModeFor } from "@/lib/billing/checkout-mode";
import { createPurchase, freeExamAttempt, fulfilPurchase, itemSchema, receiptPath, resolveItem } from "@/lib/billing/purchases";

export const dynamic = "force-dynamic";

/**
 * Starts a purchase of anything CaseCode sells (src/lib/billing/purchases.ts).
 *
 * The body names the item; the price is resolved here. With Razorpay
 * connected this opens an order for the browser's checkout widget, and
 * /api/billing/verify (or the webhook) fulfils it. With the demo checkout the
 * purchase is fulfilled at once — no money moves, and the row says so.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = itemSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid item." }, { status: 400 });

  const admin = createAdminClient();

  // Complimentary accounts (074) get CaseCode's own products free: an exam
  // attempt is created directly, with no purchase. Plans and top-ups are never
  // needed.
  if (parsed.data.kind === "exam") {
    const { data: comp } = await admin.rpc("is_complimentary", { p_user: user.id });
    if (comp === true) {
      const free = await freeExamAttempt(admin, user.id, parsed.data.slug);
      return NextResponse.json(free.body, { status: free.status });
    }
  }

  const mode = await checkoutModeFor(admin, user);
  if (mode === "closed") {
    return NextResponse.json(
      { error: "Online payment isn't open yet. It will be soon." },
      { status: 503 },
    );
  }

  const resolved = await resolveItem(admin, user.id, parsed.data);
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

  const purchase = await createPurchase(admin, user.id, resolved.item, mode);
  if (!purchase) return NextResponse.json({ error: "Could not start the purchase." }, { status: 500 });

  if (mode === "demo") {
    const done = await fulfilPurchase(admin, purchase.id, `demo_pay_${purchase.id.slice(0, 8)}`);
    if (!done || done.status === "created") {
      return NextResponse.json({ error: "Could not complete the purchase." }, { status: 500 });
    }
    return NextResponse.json({ mode, purchase_id: purchase.id, status: done.status, redirect: receiptPath(purchase.id) });
  }

  let order;
  try {
    order = await createOrder(purchase.amount_paise, `cc_${purchase.id.replace(/-/g, "").slice(0, 30)}`);
  } catch (error) {
    await admin.from("purchases").update({ status: "failed" }).eq("id", purchase.id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start checkout." },
      { status: 502 },
    );
  }

  // Recorded before the browser opens the widget, so a payment that succeeds
  // while the tab is closed still has a row for the webhook to find.
  await admin.from("purchases").update({ razorpay_order_id: order.id }).eq("id", purchase.id);

  return NextResponse.json({
    mode,
    purchase_id: purchase.id,
    order_id: order.id,
    amount: purchase.amount_paise,
    currency: CURRENCY,
    description: purchase.description,
    // Publishable by design — it identifies the merchant, it does not authorise
    // anything. The secret never leaves the server.
    key_id: process.env.RAZORPAY_KEY_ID,
    redirect: receiptPath(purchase.id),
  });
}
