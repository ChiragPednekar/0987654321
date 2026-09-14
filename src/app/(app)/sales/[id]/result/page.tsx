import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SalesDebriefPanel } from "@/components/sales/sales-debrief";
import type { SalesDebrief, SalesScenarioRow } from "@/lib/types/database";

export const metadata: Metadata = { title: "Sales role-play review" };

export default async function SalesResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/sales/${id}/result`);

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("sales_sessions")
    .select("id, user_id, scenario_id, status, uncovered, resolved, turns, outcome_reason, debrief")
    .eq("id", id)
    .maybeSingle();
  if (!session || session.user_id !== user.id) notFound();
  if (session.status === "live") redirect(`/sales/${id}`);

  // The meeting is over, so the buyer's hidden side is now the lesson.
  const [{ data: scenario }, { data: messages }] = await Promise.all([
    admin.from("sales_scenarios").select("*").eq("id", session.scenario_id).maybeSingle<SalesScenarioRow>(),
    admin.from("sales_messages").select("role, content, overridden").eq("session_id", id).order("created_at"),
  ]);
  if (!scenario) notFound();

  const debrief = session.debrief && Object.keys(session.debrief).length > 0 ? (session.debrief as SalesDebrief) : null;
  const found = Object.keys(session.uncovered).length;
  const required = new Set(scenario.buy_rule.objectionsRequired);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <Link href="/sales" className="text-sm text-muted-foreground hover:text-foreground">
          ← Sales role-play
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{scenario.title}</h1>
          <Badge variant={session.status === "won" ? "default" : "outline"}>
            {session.status === "won" ? "Sold" : "No sale"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {session.status === "won" ? "The buyer agreed" : `Ended: ${session.outcome_reason ?? "no sale"}`} ·{" "}
          {session.turns} turns · {found} of {scenario.needs.length} needs uncovered (the buyer needed{" "}
          {scenario.buy_rule.needsRequired})
        </p>
      </div>

      <SalesDebriefPanel sessionId={id} initial={debrief} />

      <section>
        <h2 className="text-sm font-semibold">What the buyer needed</h2>
        <div className="mt-2 space-y-2">
          {scenario.needs.map((n) => {
            const hit = session.uncovered[n.key];
            return (
              <Card key={n.key}>
                <CardContent className="flex gap-2.5 p-3.5 text-sm">
                  {hit ? <Check className="mt-0.5 size-4 shrink-0 text-[var(--success)]" /> : <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                  <div>
                    <p className="font-medium">{n.label}</p>
                    <p className="text-muted-foreground">{n.detail}</p>
                    {hit && (
                      <p className="mt-1 text-xs">
                        Uncovered on turn {hit.turn} when you said: <span className="italic">“{hit.quote}”</span>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">The concerns they had</h2>
        <div className="mt-2 space-y-2">
          {scenario.objections.map((o) => {
            const hit = session.resolved[o.key];
            return (
              <Card key={o.key}>
                <CardContent className="flex gap-2.5 p-3.5 text-sm">
                  {hit ? <Check className="mt-0.5 size-4 shrink-0 text-[var(--success)]" /> : <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                  <div>
                    <p className="font-medium">
                      {o.label} {required.has(o.key) && <Badge variant="outline" className="ml-1">had to be resolved</Badge>}
                    </p>
                    <p className="text-muted-foreground">{o.detail}</p>
                    {hit && (
                      <p className="mt-1 text-xs">
                        Resolved on turn {hit.turn} when you said: <span className="italic">“{hit.quote}”</span>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold">Transcript</h2>
        <div className="mt-2 space-y-2">
          {(messages ?? []).map((m, i) => (
            <div key={i} className="rounded-md border p-3 text-sm">
              <p className="text-[11px] font-medium text-muted-foreground">
                {m.role === "student" ? "You" : scenario.buyer_role}
                {m.overridden && " · tried to agree before its concerns were met — held back"}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
