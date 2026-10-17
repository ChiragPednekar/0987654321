import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookSlot, type BookableSlot } from "@/components/experts/book-slot";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkoutMode, checkoutModeFor } from "@/lib/billing/checkout-mode";
import { bookableFrom, slotIsFree } from "@/lib/experts";
import { rupees } from "@/lib/pricing";
import type { ExpertRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Book an expert" };

export default async function ExpertPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const profile = await getCurrentUser();
  const admin = createAdminClient();

  const { data } = await admin.from("experts").select("*").eq("id", id).maybeSingle();
  const expert = data as ExpertRow | null;
  if (!expert || expert.status !== "approved") notFound();

  const [{ data: slots }, { data: reviews }, mode] = await Promise.all([
    admin
      .from("expert_slots")
      .select("id, starts_at, duration_minutes, status, held_until")
      .eq("expert_id", id)
      .in("status", ["open", "held"])
      .gt("starts_at", bookableFrom())
      .order("starts_at")
      .limit(60),
    admin
      .from("expert_bookings")
      .select("rating, review, completed_at")
      .eq("expert_id", id)
      .not("rating", "is", null)
      .order("completed_at", { ascending: false })
      .limit(10),
    profile ? checkoutModeFor(admin, profile) : Promise.resolve(checkoutMode()),
  ]);

  const bookable: BookableSlot[] = (slots ?? []).filter((s) => slotIsFree(s)).map((s) => {
    const d = new Date(s.starts_at);
    return {
      id: s.id,
      duration: s.duration_minutes,
      day: d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }),
      label: d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }),
    };
  });

  const own = profile?.id === expert.user_id;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6">
      <Link href="/experts" className="text-sm text-muted-foreground hover:text-foreground">
        ← All experts
      </Link>
      <div className="mt-6 grid gap-x-14 gap-y-10 lg:grid-cols-[1fr_24rem]">
        <section>
          <h1 className="font-editorial text-[2.6rem] font-normal leading-tight">{expert.display_name}</h1>
          <p className="mt-1 text-[15px]">{expert.headline}</p>
          <p className="mt-2 text-xs text-muted-foreground">{expert.expertise.join(" · ")}</p>
          {expert.bio && <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{expert.bio}</p>}
          {expert.linkedin_url && (
            <a href={expert.linkedin_url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm underline underline-offset-4">
              LinkedIn
            </a>
          )}
          {(reviews ?? []).length > 0 && (
            <div className="mt-10 border-t border-border pt-4">
              <h2 className="font-editorial text-xl font-normal">What students said</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {(reviews ?? []).map((r, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs">{"★".repeat(r.rating ?? 0)}</span>
                    {r.review && <p className="text-muted-foreground">{r.review}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="border-t-2 border-foreground pt-5">
          <p className="text-sm text-muted-foreground">One session</p>
          <p className="font-editorial text-5xl">{rupees(expert.price_paise)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Live interview, then written feedback. Times in IST.</p>
          <div className="mt-6">
            {own ? (
              <p className="text-sm text-muted-foreground">
                This is your profile. <Link href="/experts/dashboard" className="underline underline-offset-4">Manage your slots</Link>.
              </p>
            ) : (
              <BookSlot
                slots={bookable}
                priceLabel={rupees(expert.price_paise)}
                mode={mode}
                signedIn={Boolean(profile)}
                email={profile?.email}
                name={profile?.full_name}
                expertId={expert.id}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
