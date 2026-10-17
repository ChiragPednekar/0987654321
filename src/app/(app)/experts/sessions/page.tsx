import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { RateSession } from "@/components/experts/session-actions";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSlot } from "@/lib/experts";
import { rupees } from "@/lib/pricing";
import type { ExpertBookingRow, ExpertRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Your expert sessions" };
export const dynamic = "force-dynamic";

/** A student's bookings: the meeting link before, the feedback after. */
export default async function SessionsPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/experts/sessions");
  const admin = createAdminClient();

  const { data } = await admin.from("expert_bookings").select("*").eq("student_id", profile.id).order("created_at", { ascending: false });
  const bookings = (data ?? []) as ExpertBookingRow[];
  const [{ data: experts }, { data: slots }] = await Promise.all([
    bookings.length
      ? admin.from("experts").select("*").in("id", Array.from(new Set(bookings.map((b) => b.expert_id))))
      : Promise.resolve({ data: [] as ExpertRow[] }),
    bookings.length
      ? admin.from("expert_slots").select("id, starts_at, duration_minutes").in("id", bookings.map((b) => b.slot_id))
      : Promise.resolve({ data: [] as { id: string; starts_at: string; duration_minutes: number }[] }),
  ]);
  const expertOf = new Map(((experts ?? []) as ExpertRow[]).map((e) => [e.id, e]));
  const slotOf = new Map((slots ?? []).map((s) => [s.id, s]));

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-10 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Expert mock interviews</p>
      <h1 className="mt-4 font-editorial text-[2.6rem] font-normal leading-tight">Your sessions</h1>

      <ul className="mt-10 divide-y divide-border border-y-2 border-foreground">
        {bookings.map((b) => {
          const expert = expertOf.get(b.expert_id);
          const slot = slotOf.get(b.slot_id);
          return (
            <li key={b.id} className="space-y-3 py-6 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/experts/${b.expert_id}`} className="font-editorial text-2xl hover:underline">
                  {expert?.display_name ?? "Expert"}
                </Link>
                <span className="font-mono text-xs text-muted-foreground">
                  {slot ? `${formatSlot(slot.starts_at)} · ${slot.duration_minutes} min` : ""} · {rupees(b.price_paise)}
                </span>
              </div>

              {b.status === "confirmed" && (
                <p>
                  {expert?.meeting_url ? (
                    <>
                      Join at the time above:{" "}
                      <a href={expert.meeting_url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                        {expert.meeting_url}
                      </a>
                    </>
                  ) : (
                    <span className="text-muted-foreground">The expert will share the meeting link before the session.</span>
                  )}
                </p>
              )}
              {b.status === "no_show" && <p className="text-muted-foreground">Marked as a no-show.</p>}
              {b.status === "cancelled" && <p className="text-muted-foreground">Cancelled.</p>}

              {b.status === "completed" && (
                <div className="space-y-3">
                  <div className="border-l-2 border-foreground/40 pl-4">
                    <p className="font-medium">Feedback</p>
                    <p className="mt-1 whitespace-pre-line text-muted-foreground">{b.expert_feedback}</p>
                  </div>
                  {b.rating ? (
                    <p className="font-mono text-xs text-muted-foreground">You rated this {b.rating}★</p>
                  ) : (
                    <RateSession id={b.id} />
                  )}
                </div>
              )}
            </li>
          );
        })}
        {bookings.length === 0 && (
          <li className="py-10 text-sm text-muted-foreground">
            No sessions yet. <Link href="/experts" className="text-foreground underline underline-offset-4">Find an expert</Link>.
          </li>
        )}
      </ul>
    </div>
  );
}
