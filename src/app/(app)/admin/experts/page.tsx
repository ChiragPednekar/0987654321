import Link from "next/link";
import type { Metadata } from "next";
import { Section } from "@/components/section";
import { AdminExpertAction } from "@/components/experts/session-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { rupees } from "@/lib/pricing";
import { formatDay } from "@/lib/utils";
import type { ExpertBookingRow, ExpertRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Experts" };
export const dynamic = "force-dynamic";

/**
 * Expert applications to review, live experts, and what each is owed. The
 * owner pays experts outside the app and records it here with "Mark paid".
 * /admin is gated to the admin role by the middleware.
 */
export default async function AdminExpertsPage() {
  const admin = createAdminClient();
  const [{ data: experts }, { data: bookings }, { data: purchases }] = await Promise.all([
    admin.from("experts").select("*").order("created_at", { ascending: false }),
    admin.from("expert_bookings").select("*"),
    admin.from("purchases").select("kind, amount_paise, source, status").eq("status", "paid"),
  ]);
  const all = (bookings ?? []) as ExpertBookingRow[];
  const list = (experts ?? []) as ExpertRow[];
  const pendingApps = list.filter((e) => e.status === "pending");
  const others = list.filter((e) => e.status !== "pending");

  const stats = (id: string) => {
    const mine = all.filter((b) => b.expert_id === id);
    return {
      sessions: mine.filter((b) => b.status === "completed").length,
      owed: mine.filter((b) => b.status === "completed" && b.payout_status === "pending").reduce((s, b) => s + b.payout_paise, 0),
      commission: mine.filter((b) => b.status === "completed").reduce((s, b) => s + b.commission_paise, 0),
    };
  };

  const revenue = (kind: string) =>
    (purchases ?? []).filter((p) => p.kind === kind && p.source === "razorpay").reduce((s, p) => s + p.amount_paise, 0);
  const demo = (purchases ?? []).filter((p) => p.source === "demo").length;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Admin</p>
      <h1 className="mt-4 font-editorial text-[2.6rem] font-normal leading-tight">Experts &amp; sales</h1>

      <div className="mt-8 grid gap-6 border-y border-border py-5 sm:grid-cols-4">
        {(["plan", "topup", "exam", "expert_session"] as const).map((k) => (
          <div key={k}>
            <p className="text-xs capitalize text-muted-foreground">{k.replace("_", " ")} revenue</p>
            <p className="font-editorial text-3xl">{rupees(revenue(k))}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Razorpay payments only. {demo} demo purchase{demo === 1 ? "" : "s"} moved no money and are not counted.
      </p>

      <Section title="Applications" count={pendingApps.length}>
        <ul className="divide-y divide-border text-sm">
          {pendingApps.map((e) => (
            <li key={e.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <p className="font-medium">{e.display_name} — {e.headline}</p>
                <p className="text-xs text-muted-foreground">{e.expertise.join(" · ")} · {rupees(e.price_paise)} · applied {formatDay(e.created_at)}</p>
                {e.bio && <p className="mt-2 max-w-2xl whitespace-pre-line text-muted-foreground">{e.bio}</p>}
                {e.linkedin_url && (
                  <a href={e.linkedin_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline underline-offset-4">
                    LinkedIn
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                <AdminExpertAction id={e.id} action="approve" label="Approve" />
                <AdminExpertAction id={e.id} action="suspend" label="Reject" />
              </div>
            </li>
          ))}
          {pendingApps.length === 0 && <li className="py-4 text-muted-foreground">No applications waiting.</li>}
        </ul>
      </Section>

      <Section title="Experts" count={others.length}>
        <ul className="divide-y divide-border text-sm">
          {others.map((e) => {
            const s = stats(e.id);
            return (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/experts/${e.id}`} className="font-medium hover:underline">{e.display_name}</Link>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {e.status} · {s.sessions} sessions · commission {rupees(s.commission)} · owed {rupees(s.owed)}
                  </span>
                </div>
                <div className="flex gap-2">
                  {s.owed > 0 && <AdminExpertAction id={e.id} action="mark_paid" label={`Mark ${rupees(s.owed)} paid`} />}
                  {e.status === "approved" ? (
                    <AdminExpertAction id={e.id} action="suspend" label="Suspend" />
                  ) : (
                    <AdminExpertAction id={e.id} action="approve" label="Reinstate" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
