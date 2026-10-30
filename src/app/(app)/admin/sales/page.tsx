import type { Metadata } from "next";
import { Section } from "@/components/section";
import { createAdminClient } from "@/lib/supabase/admin";
import { rupees } from "@/lib/pricing";
import { formatDay } from "@/lib/utils";
import type { PurchaseRow } from "@/lib/types/database";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Sales" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { plan: "Plans", topup: "Top-ups", exam: "Exam attempts" };

/**
 * What has been sold: revenue by product, and the latest purchases. Only
 * Razorpay payments count as revenue; demo purchases moved no money.
 * /admin is gated to the admin role by the middleware.
 */
export default async function AdminSalesPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("purchases")
    .select("*")
    .in("status", ["paid", "needs_refund", "refunded"])
    .order("created_at", { ascending: false })
    .limit(200);
  const purchases = (data ?? []) as PurchaseRow[];
  const revenue = (kind: string) =>
    purchases.filter((p) => p.kind === kind && p.source === "razorpay" && p.status === "paid").reduce((s, p) => s + p.amount_paise, 0);
  const demo = purchases.filter((p) => p.source === "demo").length;

  return (
    <div className="min-w-0">
      <PageHeader eyebrow="Commercial" title="Sales" subtitle="Revenue by product, and every purchase." />

      <div className="mt-8 grid gap-6 border-y border-border py-5 sm:grid-cols-3">
        {Object.entries(KIND_LABEL).map(([k, label]) => (
          <div key={k}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-editorial text-3xl">{rupees(revenue(k))}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Razorpay payments only. {demo} demo purchase{demo === 1 ? "" : "s"} moved no money and {demo === 1 ? "is" : "are"} not counted.
      </p>

      <Section title="Latest purchases" count={purchases.length}>
        <ul className="divide-y divide-border text-sm">
          {purchases.map((p) => (
            <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
              <span className="truncate">{p.description}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {rupees(p.amount_paise)} · {p.source} · {p.status} · {formatDay(p.created_at)}
              </span>
            </li>
          ))}
          {purchases.length === 0 && <li className="py-4 text-muted-foreground">No purchases yet.</li>}
        </ul>
      </Section>
    </div>
  );
}
