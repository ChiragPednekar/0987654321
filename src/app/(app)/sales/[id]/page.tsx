import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { SalesRoom, type SalesTurn } from "@/components/sales/sales-room";

export const metadata: Metadata = { title: "Sales role-play" };

export default async function SalesMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/sales/${id}`);

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("sales_sessions")
    .select("id, user_id, scenario_id, status, turns")
    .eq("id", id)
    .maybeSingle();
  if (!session || session.user_id !== user.id) notFound();
  if (session.status !== "live") redirect(`/sales/${id}/result`);

  // Only what the seller may see. The buyer's side is not granted to clients
  // and is not selected here.
  const [{ data: scenario }, { data: messages }] = await Promise.all([
    admin
      .from("sales_scenarios")
      .select("title, sector, shared_brief, student_role, buyer_role, student_brief, max_turns")
      .eq("id", session.scenario_id)
      .maybeSingle(),
    admin.from("sales_messages").select("role, content").eq("session_id", id).order("created_at"),
  ]);
  if (!scenario) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="order-2 lg:order-1">
          <h1 className="mb-3 font-semibold">{scenario.title}</h1>
          <SalesRoom
            sessionId={id}
            buyerRole={scenario.buyer_role}
            initial={(messages ?? []) as SalesTurn[]}
            turnsUsed={session.turns}
            maxTurns={scenario.max_turns}
          />
        </div>
        <div className="order-1 space-y-3 lg:order-2">
          <Card>
            <CardContent className="space-y-3 p-4 text-sm">
              <p className="text-muted-foreground">{scenario.shared_brief}</p>
              <div className="rounded-md border border-border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Your brief — {scenario.student_role}
                </p>
                <p className="mt-1 whitespace-pre-line">{scenario.student_brief}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
