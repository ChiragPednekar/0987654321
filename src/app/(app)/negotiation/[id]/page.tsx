import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import {
  NegotiationRoom,
  type NegotiationTurn,
} from "@/components/negotiation/negotiation-room";

export const metadata: Metadata = { title: "Negotiation" };

export default async function NegotiationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/negotiation/${id}`);

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("negotiation_sessions")
    .select("id, user_id, case_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!session || session.user_id !== user.id) notFound();
  if (session.status !== "live") redirect(`/negotiation/${id}/result`);

  // Only the student's own side is selected. The counterparty columns are not
  // granted to clients at all, and nothing here would send them if they were.
  const { data: kase } = await admin
    .from("negotiation_cases")
    .select(
      "title, shared_brief, student_role, counterparty_role, student_brief, issues, student_payoffs, student_batna",
    )
    .eq("id", session.case_id)
    .maybeSingle();

  if (!kase) notFound();

  const { data: messages } = await admin
    .from("negotiation_messages")
    .select("role, content, offer")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Card>
        <CardContent className="p-5">
          <h1 className="font-semibold">{kase.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{kase.shared_brief}</p>
          <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Your brief — {kase.student_role}
            </p>
            <p className="mt-1 text-sm">{kase.student_brief}</p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-5">
        <NegotiationRoom
          sessionId={id}
          issues={kase.issues}
          payoffs={kase.student_payoffs}
          batna={kase.student_batna}
          counterpartyRole={kase.counterparty_role}
          initial={(messages ?? []) as NegotiationTurn[]}
        />
      </div>
    </div>
  );
}
