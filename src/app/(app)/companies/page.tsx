import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { COMPANY_SECTORS } from "@/lib/companies";
import { plural } from "@/lib/utils";

export const metadata: Metadata = { title: "Company prep" };

export default async function CompaniesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/companies");

  const admin = createAdminClient();
  const [{ data: companies }, { data: approved }] = await Promise.all([
    admin
      .from("companies")
      .select("id, slug, name, sector, roles, summary, sources, official_links")
      .eq("is_published", true)
      .order("name"),
    admin.from("company_question_reports").select("company_id").eq("status", "approved"),
  ]);

  const questionsOf = new Map<string, number>();
  for (const r of approved ?? []) questionsOf.set(r.company_id, (questionsOf.get(r.company_id) ?? 0) + 1);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">Company prep</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        How each firm&apos;s process usually runs, what it tends to look for, the practice here
        that matches — and questions students were actually asked, reported by them.
      </p>
      <p className="mt-2 max-w-2xl text-xs text-muted-foreground">
        Profiles are general guidance. Each one is marked unverified until it has been checked
        against an official source, and lists that source once it has.
      </p>

      {COMPANY_SECTORS.map((sector) => {
        const inSector = (companies ?? []).filter((c) => c.sector === sector);
        if (inSector.length === 0) return null;
        return (
          <section key={sector} className="mt-8">
            <h2 className="text-xs font-medium text-muted-foreground">
              {sector}
            </h2>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {inSector.map((c) => {
                const n = questionsOf.get(c.id) ?? 0;
                const verified = (c.sources ?? []).length > 0;
                const officialCount = (c.official_links ?? []).length;
                return (
                  <Link key={c.slug} href={`/companies/${c.slug}`}>
                    <Card className="h-full transition-colors hover:border-foreground/25">
                      <CardContent className="flex h-full flex-col gap-1.5 p-4">
                        <p className="font-medium">{c.name}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{c.roles.join(" · ")}</p>
                        <p className="line-clamp-3 text-sm text-muted-foreground">{c.summary}</p>
                        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                          <span className="min-w-0 truncate">
                            {n > 0 ? `${plural(n, "reported question")}` : "No reported questions yet"}
                          </span>
                          {/*
                            Says what the card HAS rather than what it lacks.
                            "Not verified" was accurate and useless: it read as
                            a defect on every card, told a student nothing they
                            could act on, and did not change when the firm's own
                            pages were added beneath it. The link count is the
                            thing worth scanning for.
                          */}
                          <span
                            className={
                              verified
                                ? "shrink-0 text-success"
                                : officialCount > 0
                                  ? "shrink-0 text-brand"
                                  : "shrink-0 text-muted-foreground"
                            }
                          >
                            {verified
                              ? "Sources checked"
                              : officialCount > 0
                                ? plural(officialCount, "official link")
                                : "Guidance only"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <p className="mt-10 text-xs text-muted-foreground">
        CaseCode is not affiliated with, endorsed by, or connected to any company listed. Processes
        vary by year, campus and role — confirm the details with your placement cell.
      </p>
    </div>
  );
}
