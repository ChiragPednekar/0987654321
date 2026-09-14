import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StartSalesButton } from "@/components/sales/sales-room";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Sales role-play" };

export default async function SalesLobby() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/sales");

  const admin = createAdminClient();
  const [{ data: scenarios }, { data: past }] = await Promise.all([
    admin
      .from("sales_scenarios")
      .select("id, slug, title, sector, difficulty, shared_brief, student_role, buyer_role")
      .eq("is_published", true)
      .order("difficulty"),
    admin
      .from("sales_sessions")
      .select("id, scenario_id, status, started_at")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(8),
  ]);
  const titleOf = new Map((scenarios ?? []).map((s) => [s.id, s.title]));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Sales role-play</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sell to a buyer with needs they will not volunteer and concerns they will raise. The
        role-play FMCG, BFSI and B2B sales interviews are built around.
      </p>

      <Card className="mt-6 border-muted">
        <CardContent className="p-4 text-xs text-muted-foreground">
          The buyer agrees only once you have found enough of what they need and answered the
          concerns that matter to them. Pushing, discounting or repeating the pitch will not
          close it. Afterwards you see what they were thinking all along, and a review of how
          you sold.
        </CardContent>
      </Card>

      <div className="mt-6 space-y-3">
        {(scenarios ?? []).map((s) => (
          <Card key={s.slug}>
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{s.title}</p>
                  <Badge variant="outline">{s.difficulty}</Badge>
                  <Badge variant="secondary">{s.sector}</Badge>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  You are the {s.student_role.toLowerCase()}, meeting the {s.buyer_role.toLowerCase()}.
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{s.shared_brief}</p>
              </div>
              <StartSalesButton slug={s.slug} />
            </CardContent>
          </Card>
        ))}
      </div>

      {(past ?? []).length > 0 && (
        <>
          <h2 className="mt-10 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Your meetings
          </h2>
          <div className="mt-3 space-y-2">
            {(past ?? []).map((p) => (
              <Link key={p.id} href={p.status === "live" ? `/sales/${p.id}` : `/sales/${p.id}/result`}>
                <Card className="transition-colors hover:border-primary/40">
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-sm font-medium">{titleOf.get(p.scenario_id) ?? "Meeting"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(p.started_at)}</p>
                    </div>
                    <Badge variant={p.status === "won" ? "default" : "outline"}>
                      {p.status === "live" ? "in progress" : p.status === "won" ? "sold" : "no sale"}
                    </Badge>
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
