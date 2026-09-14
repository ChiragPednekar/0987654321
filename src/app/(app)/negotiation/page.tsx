import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StartNegotiationButton } from "@/components/negotiation/start-button";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Negotiation" };

export default async function NegotiationLobby() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/negotiation");

  const admin = createAdminClient();
  const [{ data: cases }, { data: past }] = await Promise.all([
    admin
      .from("negotiation_cases")
      .select("slug, title, shared_brief, student_role, counterparty_role, difficulty")
      .eq("is_published", true)
      .order("difficulty"),
    admin
      .from("negotiation_sessions")
      .select("id, status, student_score, efficiency_pct, beat_batna, started_at, negotiation_cases(title)")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(8),
  ]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Negotiation</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Multi-issue deals against a counterparty with its own interests, its own
        priorities, and a walk-away point you cannot argue it past.
      </p>

      <Card className="mt-6 border-muted">
        <CardContent className="p-4 text-xs text-muted-foreground">
          You are scored on two things kept deliberately apart: how much you
          claimed for yourself, and how much total value the two of you found.
          It is entirely possible to win the argument and still leave money on
          the table — that is usually the more useful lesson.
        </CardContent>
      </Card>

      <div className="mt-6 space-y-3">
        {(cases ?? []).map((c) => (
          <Card key={c.slug}>
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{c.title}</p>
                  <Badge variant="outline">{c.difficulty}</Badge>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  You are the {c.student_role.toLowerCase()}, against the{" "}
                  {c.counterparty_role.toLowerCase()}.
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {c.shared_brief}
                </p>
              </div>
              <StartNegotiationButton slug={c.slug} />
            </CardContent>
          </Card>
        ))}
      </div>

      {(past ?? []).length > 0 && (
        <>
          <h2 className="mt-10 text-sm font-semibold text-foreground">
            Your negotiations
          </h2>
          <div className="mt-3 space-y-2">
            {(past ?? []).map((p) => {
              const c = Array.isArray(p.negotiation_cases)
                ? p.negotiation_cases[0]
                : p.negotiation_cases;
              return (
                <Link
                  key={p.id}
                  href={p.status === "live" ? `/negotiation/${p.id}` : `/negotiation/${p.id}/result`}
                >
                  <Card className="transition-colors hover:border-foreground/25">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div>
                        <p className="text-sm font-medium">{c?.title ?? "Negotiation"}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {timeAgo(p.started_at)}
                        </p>
                      </div>
                      {p.status === "deal" ? (
                        <span className="text-sm tabular">
                          <span className="font-semibold">{p.student_score}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {p.efficiency_pct}% efficient
                          </span>
                        </span>
                      ) : (
                        <Badge variant="outline">
                          {p.status === "live" ? "in progress" : "no deal"}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
