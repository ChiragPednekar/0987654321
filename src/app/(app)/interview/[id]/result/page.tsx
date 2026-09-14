import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { PI_CRITERIA, PI_CRITERION_LABEL, PI_KINDS } from "@/lib/pi";

export const metadata: Metadata = { title: "Interview assessment" };

export default async function PiResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/interview/${id}/result`);

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("pi_sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!session || session.user_id !== user.id) notFound();

  const { data: messages } = await admin
    .from("pi_messages")
    .select("role, content")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  const fb = session.feedback ?? {};
  const kind = PI_KINDS.find((k) => k.value === session.kind);
  const pct =
    session.total !== null && session.max_score > 0
      ? Math.round((session.total / session.max_score) * 100)
      : 0;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link href="/interview" className="text-sm text-muted-foreground hover:text-foreground">
        ← Interviews
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        {kind?.label ?? session.kind}
        {session.target_firm ? ` · ${session.target_firm}` : ""}
      </h1>

      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-4xl font-medium leading-none tabular">
              {session.total ?? 0}
              <span className="text-2xl text-muted-foreground">/{session.max_score}</span>
            </p>
            <span className="text-sm text-muted-foreground tabular">{pct}%</span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {Object.entries(PI_CRITERIA).map(([key, max]) => {
              const got = Number(session.breakdown?.[key] ?? 0);
              return (
                <div key={key}>
                  <p className="text-xs text-muted-foreground">
                    {PI_CRITERION_LABEL[key] ?? key}
                  </p>
                  <p className="text-sm font-medium tabular">
                    {got}
                    <span className="text-muted-foreground">/{max}</span>
                  </p>
                </div>
              );
            })}
          </div>

          {fb.verdict && (
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              {fb.verdict}
            </p>
          )}
        </CardContent>
      </Card>

      {(fb.strengths?.length || fb.weaknesses?.length) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {fb.strengths?.length ? (
            <Card>
              <CardContent className="p-5">
                <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--success)]">
                  <CheckCircle2 className="size-4" /> What worked
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {fb.strengths.map((s) => (
                    <li key={s}>· {s}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
          {fb.weaknesses?.length ? (
            <Card>
              <CardContent className="p-5">
                <p className="text-sm font-medium text-[var(--warning)]">
                  Before your next interview
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                  {fb.weaknesses.map((w) => (
                    <li key={w}>· {w}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      <h2 className="mt-8 text-sm font-semibold text-foreground">
        Transcript
      </h2>
      <div className="mt-3 space-y-2">
        {(messages ?? []).map((m, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <p className="text-[11px] font-medium text-muted-foreground">
                {m.role === "interviewer" ? "Interviewer" : "You"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                {m.content}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
