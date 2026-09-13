import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Handshake, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Issue, Terms } from "@/lib/negotiation/engine";

export const metadata: Metadata = { title: "Negotiation result" };

export default async function NegotiationResult({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/negotiation/${id}/result`);

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("negotiation_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!session || session.user_id !== user.id) notFound();
  if (session.status === "live") redirect(`/negotiation/${id}`);

  /**
   * The counterparty's side is read here with the service role and shown only
   * now. Revealing what they actually valued is the point of the debrief — and
   * it is safe only because the negotiation is over and scored.
   */
  const { data: kase } = await admin
    .from("negotiation_cases")
    .select("title, issues, counterparty_payoffs, counterparty_role, counterparty_batna, student_batna")
    .eq("id", session.case_id)
    .maybeSingle();

  if (!kase) notFound();

  const issues = kase.issues as Issue[];
  const terms = (session.agreed_terms ?? {}) as Terms;
  const dealt = session.status === "deal";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href="/negotiation" className="text-sm text-muted-foreground hover:text-foreground">
        ← Negotiation
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{kase.title}</h1>
        {dealt ? (
          <Badge className="gap-1">
            <Handshake className="size-3" /> deal
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1">
            <XCircle className="size-3" /> no deal
          </Badge>
        )}
      </div>

      {dealt ? (
        <>
          <Card className="mt-5">
            <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  You claimed
                </p>
                <p
                  className={cn(
                    "mt-1 text-3xl font-semibold tabular",
                    session.beat_batna ? "text-[var(--success)]" : "text-destructive",
                  )}
                >
                  {session.student_score}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Walking away was worth {kase.student_batna}
                  {session.beat_batna ? "" : " — no deal was the better option"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Value found
                </p>
                <p className="mt-1 text-3xl font-semibold tabular">
                  {session.efficiency_pct}%
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {session.joint_value} of a possible {session.max_joint} between you
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  They got
                </p>
                <p className="mt-1 text-3xl font-semibold tabular text-muted-foreground">
                  {session.counterparty_score}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Their walk-away was {kase.counterparty_batna}
                </p>
              </div>
            </CardContent>
          </Card>

          {/*
            The reveal. Seeing what the other side valued, next to what you
            chose, is where the lesson lands: an issue you fought over that was
            cheap to them was value you could have traded for.
          */}
          <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            What they actually wanted
          </h2>
          <div className="mt-3 space-y-3">
            {issues.map((issue) => {
              const chosen = terms[issue.key];
              const theirs = (kase.counterparty_payoffs as Record<string, Record<string, number>>)[
                issue.key
              ];
              const theirBest = issue.options.reduce((b, o) =>
                (theirs?.[o.key] ?? 0) > (theirs?.[b.key] ?? 0) ? o : b,
              );
              return (
                <Card key={issue.key}>
                  <CardContent className="p-4">
                    <p className="text-sm font-medium">{issue.label}</p>
                    <div className="mt-2 space-y-1">
                      {issue.options.map((o) => (
                        <div
                          key={o.key}
                          className={cn(
                            "flex items-center justify-between rounded px-2 py-1 text-xs",
                            o.key === chosen && "bg-primary/10 font-medium",
                          )}
                        >
                          <span>
                            {o.label}
                            {o.key === chosen && " — agreed"}
                          </span>
                          <span className="text-muted-foreground tabular">
                            worth {theirs?.[o.key] ?? 0} to them
                          </span>
                        </div>
                      ))}
                    </div>
                    {chosen !== theirBest.key && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        They would have paid most for {theirBest.label}.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <Card className="mt-5">
          <CardContent className="p-6">
            <p className="text-sm">
              You walked away without a deal, which scores {kase.student_batna} —
              your BATNA.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              That is sometimes the right call. It was the right call here only
              if nothing on the table beat {kase.student_batna} for you, and the
              counterparty could not have been moved. Their walk-away was{" "}
              {kase.counterparty_batna}, so there was room above that to work in.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
