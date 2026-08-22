import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/server";
import { createAdminClientOrNull } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/sparkline";
import { DOMAIN_LABEL } from "@/lib/constants";
import type { Domain } from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Candidates",
  description: "Opted-in candidates ranked by demonstrated case performance.",
};

interface Candidate {
  id: string;
  full_name: string | null;
  university: string | null;
  career_goal: string | null;
  cases_solved: number;
  ce: number;
  trend: number[];
  strongest: string | null;
}

export default async function RecruiterPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/recruiter");

  // Recruiters and admins only. Students never see other people's histories.
  if (profile.role !== "recruiter" && profile.role !== "admin") {
    redirect("/dashboard");
  }

  // Service role: assembling a candidate view means reading other users' score
  // history, which no ordinary session is granted. The role check above is the
  // gate; this is what gets past the grants.
  const admin = createAdminClientOrNull();
  if (!admin) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
        <Card className="mt-6">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Candidate search is unavailable — the server is missing its
            service-role key.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Opt-in only. A student is invisible here until they switch the flag on in
  // Settings, and it defaults to off.
  const { data: users } = await admin
    .from("users")
    .select("id, full_name, university, career_goal, cases_solved, ce")
    .eq("open_to_opportunities", true)
    .order("ce", { ascending: false })
    .limit(50);

  const candidates: Candidate[] = [];

  for (const user of users ?? []) {
    const [{ data: scores }, { data: domains }] = await Promise.all([
      admin
        .from("scores")
        .select("percentage, evaluated_at")
        .eq("user_id", user.id)
        .order("evaluated_at", { ascending: true })
        .limit(20),
      admin
        .from("domain_progress")
        .select("domain, avg_percentage")
        .eq("user_id", user.id)
        .order("avg_percentage", { ascending: false })
        .limit(1),
    ]);

    candidates.push({
      ...user,
      trend: (scores ?? []).map((s) => Number(s.percentage)),
      strongest: domains?.[0]?.domain ?? null,
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <Building2 className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Students who have opted in to being contacted, ranked by CE. Performance
        here is demonstrated on graded cases, not self-reported.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Open to opportunities{" "}
            <span className="text-sm font-normal text-muted-foreground tabular">
              ({candidates.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nobody has opted in yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 font-medium">Candidate</th>
                    <th className="py-2 font-medium">University</th>
                    <th className="py-2 font-medium">Strongest</th>
                    <th className="py-2 text-right font-medium">Solved</th>
                    <th className="py-2 text-right font-medium">CE</th>
                    <th className="py-2 text-right font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate) => (
                    <tr
                      key={candidate.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-2">
                        <Link
                          href={`/u/${candidate.id}`}
                          className="font-medium hover:underline"
                        >
                          {candidate.full_name ?? "Anonymous"}
                        </Link>
                        {candidate.career_goal ? (
                          <p className="text-xs text-muted-foreground">
                            {candidate.career_goal}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {candidate.university ?? "—"}
                      </td>
                      <td className="py-2">
                        {candidate.strongest ? (
                          <Badge variant="outline">
                            {DOMAIN_LABEL[candidate.strongest as Domain]}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2 text-right tabular">
                        {candidate.cases_solved}
                      </td>
                      <td className="py-2 text-right tabular">{candidate.ce}</td>
                      <td className="py-2">
                        <div className="flex justify-end">
                          <Sparkline
                            values={candidate.trend}
                            label={`${candidate.full_name ?? "Candidate"} score trend`}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
