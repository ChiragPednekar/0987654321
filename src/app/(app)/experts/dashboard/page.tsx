import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Section } from "@/components/section";
import { ExpertProfileForm } from "@/components/experts/expert-profile-form";
import { SlotAdder, WithdrawSlot } from "@/components/experts/slot-manager";
import { CompleteSession } from "@/components/experts/session-actions";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayAgo, EXPERTISE, expertForUser, formatSlot, hasStarted, slotIsFree } from "@/lib/experts";
import { EXPERT_PRICE_RANGE_PAISE, rupees } from "@/lib/pricing";
import type { ExpertBookingRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Expert dashboard" };
export const dynamic = "force-dynamic";

/** The expert's own console: slots, bookings, feedback owed, earnings, profile. */
export default async function ExpertDashboard() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/experts/dashboard");
  const admin = createAdminClient();
  const expert = await expertForUser(admin, profile.id);
  if (!expert) redirect("/experts/apply");

  const [{ data: slots }, { data: bookings }] = await Promise.all([
    admin
      .from("expert_slots")
      .select("id, starts_at, duration_minutes, status, held_until")
      .eq("expert_id", expert.id)
      .neq("status", "cancelled")
      .gt("starts_at", dayAgo())
      .order("starts_at"),
    admin.from("expert_bookings").select("*").eq("expert_id", expert.id).order("created_at", { ascending: false }),
  ]);
  const all = (bookings ?? []) as ExpertBookingRow[];
  const slotTime = new Map<string, string>();
  const { data: bookedSlots } = all.length
    ? await admin.from("expert_slots").select("id, starts_at").in("id", all.map((b) => b.slot_id))
    : { data: [] as { id: string; starts_at: string }[] };
  for (const s of bookedSlots ?? []) slotTime.set(s.id, s.starts_at);
  const studentIds = Array.from(new Set(all.map((b) => b.student_id)));
  const { data: students } = studentIds.length
    ? await admin.from("users").select("id, full_name").in("id", studentIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameOf = new Map((students ?? []).map((s) => [s.id, s.full_name ?? "Student"]));

  const upcoming = all.filter((b) => b.status === "confirmed");
  const closed = all.filter((b) => b.status !== "confirmed");
  const pending = all.filter((b) => b.status === "completed" && b.payout_status === "pending").reduce((s, b) => s + b.payout_paise, 0);
  const paid = all.filter((b) => b.payout_status === "paid").reduce((s, b) => s + b.payout_paise, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Expert dashboard</p>
      <h1 className="mt-4 font-editorial text-[2.6rem] font-normal leading-tight">{expert.display_name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {expert.status === "approved" ? (
          <>
            Live and bookable · <Link href={`/experts/${expert.id}`} className="underline underline-offset-4">your public page</Link>
          </>
        ) : expert.status === "pending" ? (
          "Your application is in review. You can publish slots once it is approved."
        ) : (
          "This profile is suspended. Contact the CaseCode team."
        )}
      </p>

      <div className="mt-8 grid gap-6 border-y border-border py-5 sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Sessions booked</p>
          <p className="font-editorial text-3xl">{all.filter((b) => b.status !== "cancelled").length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Owed to you</p>
          <p className="font-editorial text-3xl">{rupees(pending)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Paid out</p>
          <p className="font-editorial text-3xl">{rupees(paid)}</p>
        </div>
      </div>

      <Section title="Upcoming sessions" count={upcoming.length}>
        <ul className="divide-y divide-border">
          {upcoming.map((b) => {
            const at = slotTime.get(b.slot_id);
            const started = hasStarted(at);
            return (
              <li key={b.id} className="space-y-2 py-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{nameOf.get(b.student_id)}</span>
                  <span className="font-mono text-xs text-muted-foreground">{at ? formatSlot(at) : ""} · you receive {rupees(b.payout_paise)}</span>
                </div>
                {b.student_notes && <p className="text-muted-foreground">“{b.student_notes}”</p>}
                {started ? <CompleteSession id={b.id} /> : <p className="text-xs text-muted-foreground">Join on your meeting link at the time above.</p>}
              </li>
            );
          })}
          {upcoming.length === 0 && <li className="py-4 text-sm text-muted-foreground">No sessions booked yet.</li>}
        </ul>
      </Section>

      {expert.status === "approved" && (
        <Section title="Your open times" count={(slots ?? []).filter((s) => s.status !== "booked").length}>
          <div className="pt-4">
            <SlotAdder />
          </div>
          <ul className="mt-4 divide-y divide-border text-sm">
            {(slots ?? [])
              .filter((s) => s.status !== "booked")
              .map((s) => (
                <li key={s.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span>
                    {formatSlot(s.starts_at)} · {s.duration_minutes} min
                    {!slotIsFree(s) ? <span className="text-muted-foreground"> · being paid for</span> : null}
                  </span>
                  {slotIsFree(s) && <WithdrawSlot id={s.id} />}
                </li>
              ))}
          </ul>
        </Section>
      )}

      {closed.length > 0 && (
        <Section title="Past sessions" count={closed.length}>
          <ul className="divide-y divide-border text-sm">
            {closed.map((b) => (
              <li key={b.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
                <span>{nameOf.get(b.student_id)}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {b.status.replace("_", "-")}
                  {b.rating ? ` · ${b.rating}★` : ""}
                  {b.status === "completed" ? ` · payout ${b.payout_status}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Profile">
        <div className="pt-4">
          <ExpertProfileForm
            mode={expert.status === "pending" ? "apply" : "edit"}
            expertise={EXPERTISE}
            priceRange={{ min: EXPERT_PRICE_RANGE_PAISE.min / 100, max: EXPERT_PRICE_RANGE_PAISE.max / 100 }}
            commissionPct={expert.commission_bps / 100}
            initial={{
              display_name: expert.display_name,
              headline: expert.headline,
              bio: expert.bio,
              expertise: expert.expertise,
              linkedin_url: expert.linkedin_url ?? "",
              meeting_url: expert.meeting_url ?? "",
              price_rupees: expert.price_paise / 100,
            }}
          />
        </div>
      </Section>
    </div>
  );
}
