import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PiLauncher } from "@/components/pi/pi-launcher";

import { PI_KINDS } from "@/lib/pi";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "HR & personal interview" };

export default async function InterviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/interview");

  const admin = createAdminClient();

  const [{ data: profile }, { data: past }] = await Promise.all([
    admin
      .from("pi_profiles")
      .select("background, target_role, target_firms")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("pi_sessions")
      .select("id, kind, status, total, max_score, started_at, target_firm")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(10),
  ]);

  const labelOf = new Map(PI_KINDS.map((k) => [k.value, k.label]));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">HR &amp; personal interview</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The round where most candidates lose an offer. The interviewer reads
        your background and digs into it — vague answers get followed up, not
        accepted.
      </p>

      <div className="mt-6">
        <PiLauncher
          initialBackground={profile?.background ?? ""}
          initialRole={profile?.target_role ?? ""}
          initialFirms={profile?.target_firms ?? ""}
        />
      </div>

      {(past ?? []).length > 0 && (
        <>
          <h2 className="mt-10 text-sm font-semibold text-foreground">
            Past interviews
          </h2>
          <div className="mt-3 space-y-2">
            {(past ?? []).map((s) => (
              <Link
                key={s.id}
                href={s.status === "completed" ? `/interview/${s.id}/result` : `/interview/${s.id}`}
              >
                <Card className="transition-colors hover:border-foreground/25">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {labelOf.get(s.kind) ?? s.kind}
                        {s.target_firm ? ` · ${s.target_firm}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {timeAgo(s.started_at)}
                      </p>
                    </div>
                    {s.status === "completed" && s.total !== null ? (
                      <span className="text-sm font-semibold tabular">
                        {s.total}/{s.max_score}
                      </span>
                    ) : (
                      <Badge variant="outline">
                        {s.status === "live" ? "in progress" : s.status}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
