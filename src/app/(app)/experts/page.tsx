import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { bookableFrom, formatSlot, slotIsFree } from "@/lib/experts";
import { EXPERT_COMMISSION_BPS, rupees } from "@/lib/pricing";
import type { ExpertRow } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Expert mock interviews",
  description: "Live mock interviews with ex-consultants, bankers and product leaders, with written feedback.",
};

export default async function ExpertsPage() {
  const admin = createAdminClient();
  const { data: experts } = await admin.from("experts").select("*").eq("status", "approved").order("approved_at");
  const ids = ((experts ?? []) as ExpertRow[]).map((e) => e.id);
  const [{ data: slots }, { data: ratings }] = await Promise.all([
    ids.length
      ? admin
          .from("expert_slots")
          .select("expert_id, starts_at, status, held_until")
          .in("expert_id", ids)
          .in("status", ["open", "held"])
          .gt("starts_at", bookableFrom())
          .order("starts_at")
      : Promise.resolve({ data: [] as { expert_id: string; starts_at: string; status: string; held_until: string | null }[] }),
    ids.length
      ? admin.from("expert_bookings").select("expert_id, rating").in("expert_id", ids).not("rating", "is", null)
      : Promise.resolve({ data: [] as { expert_id: string; rating: number | null }[] }),
  ]);

  const nextSlot = new Map<string, string>();
  for (const s of slots ?? []) {
    if (slotIsFree(s) && !nextSlot.has(s.expert_id)) nextSlot.set(s.expert_id, s.starts_at);
  }
  const ratingOf = (id: string) => {
    const rs = (ratings ?? []).filter((r) => r.expert_id === id && r.rating);
    return rs.length ? { avg: rs.reduce((s, r) => s + (r.rating ?? 0), 0) / rs.length, n: rs.length } : null;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Expert mock interviews</p>
        <h1 className="mt-4 font-editorial text-[2.6rem] font-normal leading-[0.98] tracking-[-0.02em] sm:text-[3.4rem]">
          Rehearse with someone <em className="italic">who has sat across the table</em>.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          A live case or fit interview with an ex-consultant, banker or product lead, followed by written feedback you
          can work from. Pick a time, pay when you book, join on their link.
        </p>
      </header>

      <ul className="mt-12 divide-y divide-border border-y-2 border-foreground">
        {((experts ?? []) as ExpertRow[]).map((expert) => {
          const next = nextSlot.get(expert.id);
          const rating = ratingOf(expert.id);
          return (
            <li key={expert.id} className="grid gap-3 py-6 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <Link href={`/experts/${expert.id}`} className="font-editorial text-2xl hover:underline">
                  {expert.display_name}
                </Link>
                <p className="text-sm">{expert.headline}</p>
                <p className="mt-1 text-xs text-muted-foreground">{expert.expertise.join(" · ")}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {next ? `Next free: ${formatSlot(next)}` : "No open times right now"}
                  {rating ? ` · ${rating.avg.toFixed(1)}★ (${rating.n})` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                <span className="font-editorial text-3xl">{rupees(expert.price_paise)}</span>
                <Link href={`/experts/${expert.id}`} className="text-sm underline underline-offset-4">
                  See times
                </Link>
              </div>
            </li>
          );
        })}
        {(experts ?? []).length === 0 && (
          <li className="py-10 text-sm text-muted-foreground">The first experts are being onboarded. Check back soon.</li>
        )}
      </ul>

      <p className="mt-10 text-sm text-muted-foreground">
        <Link href="/experts/sessions" className="text-foreground underline underline-offset-4">Your sessions</Link>
        {" · "}
        Interviewed for consulting, finance or product?{" "}
        <Link href="/experts/apply" className="text-foreground underline underline-offset-4">Become an expert</Link> — you
        set your price and keep {100 - EXPERT_COMMISSION_BPS / 100}%.
      </p>
    </div>
  );
}
