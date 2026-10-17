import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rupees } from "@/lib/pricing";
import { formatDayTime } from "@/lib/utils";
import type { PurchaseRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Receipt" };

/** Where to go next after each kind of purchase. */
function nextStep(p: PurchaseRow): { href: string; label: string; note: string } {
  switch (p.kind) {
    case "plan":
      return { href: "/cases", label: "Start practising", note: "CaseCode Pro is on. Every case, drill and mock interview is open." };
    case "topup":
      return { href: "/dashboard", label: "Back to practice", note: "The credits are on your account and are used after your plan's allowance." };
    case "exam":
      return {
        href: p.fulfilled_ref ? `/certificates/attempt/${p.fulfilled_ref}` : "/certificates",
        label: "Go to your exam",
        note: "Your attempt is ready. Start it when you have the full time free — the clock runs from the moment you begin.",
      };
    case "expert_session":
      return { href: "/experts/sessions", label: "See your booking", note: "Your session is booked. The meeting link is on your booking." };
  }
}

/**
 * The receipt every purchase lands on. Read through the service role and
 * checked against the signed-in account, so one student cannot open
 * another's receipt by guessing an id.
 */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentUser();
  if (!profile) redirect(`/login?next=/purchases/${id}`);

  const { data } = await createAdminClient().from("purchases").select("*").eq("id", id).maybeSingle();
  const purchase = data as PurchaseRow | null;
  if (!purchase || purchase.user_id !== profile.id) notFound();

  const step = nextStep(purchase);
  const paid = purchase.status === "paid";

  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-10 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Receipt</p>
      <h1 className="mt-4 font-editorial text-[2.4rem] font-normal leading-tight">
        {paid ? <>Payment <em className="italic">received</em>.</> : purchase.status === "needs_refund" ? "That slot was taken." : "Payment pending."}
      </h1>

      <dl className="mt-8 divide-y divide-border border-y-2 border-foreground text-sm">
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted-foreground">Item</dt>
          <dd className="text-right">{purchase.description}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted-foreground">Amount</dt>
          <dd className="font-editorial text-2xl">{rupees(purchase.amount_paise)}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted-foreground">Date</dt>
          <dd>{formatDayTime(purchase.paid_at ?? purchase.created_at)}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-muted-foreground">Reference</dt>
          <dd className="font-mono text-xs">{purchase.razorpay_payment_id ?? purchase.id.slice(0, 8)}</dd>
        </div>
      </dl>

      {purchase.source === "demo" && (
        <p className="mt-3 text-xs text-muted-foreground">Demo checkout — no money was taken.</p>
      )}

      {paid ? (
        <>
          <p className="mt-8 text-sm text-muted-foreground">{step.note}</p>
          <Button variant="ink" size="lg" className="mt-5" asChild>
            <Link href={step.href}>{step.label}</Link>
          </Button>
        </>
      ) : purchase.status === "needs_refund" ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Someone else booked that slot while your payment went through. You will be refunded in full —{" "}
          <Link href="/experts" className="underline underline-offset-4">pick another time</Link>.
        </p>
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">
          We are waiting for the payment to be confirmed. This page updates once it is.
        </p>
      )}
    </div>
  );
}
