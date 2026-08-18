import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DIFFICULTY_CLASS, DOMAIN_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Difficulty, Domain } from "@/lib/types/database";

export const metadata: Metadata = { title: "Manage cases" };

export default async function AdminCasesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/admin/cases");
  if (profile.role !== "admin") redirect("/dashboard");

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const pageSize = 50;
  const from = (page - 1) * pageSize;

  const supabase = await createClient();
  const { data: cases, count } = await supabase
    .from("cases")
    .select(
      "id, slug, title, domain, difficulty, is_published, total_submissions, avg_score",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / pageSize));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Admin
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Cases</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {count ?? 0} total
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/cases/new">New case</Link>
        </Button>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="hidden items-center gap-4 border-b border-border bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:flex">
          <span className="flex-1">Title</span>
          <span className="w-36">Domain</span>
          <span className="w-24">Difficulty</span>
          <span className="w-24 text-right">Submissions</span>
          <span className="w-20 text-right">Avg</span>
          <span className="w-20 text-right">Status</span>
        </div>

        <ul className="divide-y divide-border">
          {(cases ?? []).map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <Link
                href={`/cases/${item.slug}`}
                className="flex-1 truncate text-sm font-medium hover:underline"
              >
                {item.title}
              </Link>
              <span className="w-36 shrink-0 text-xs text-muted-foreground">
                {DOMAIN_LABEL[item.domain as Domain]}
              </span>
              <span
                className={cn(
                  "w-24 shrink-0 text-xs font-medium capitalize",
                  DIFFICULTY_CLASS[item.difficulty as Difficulty],
                )}
              >
                {item.difficulty}
              </span>
              <span className="w-24 shrink-0 text-xs text-muted-foreground tabular sm:text-right">
                {item.total_submissions}
              </span>
              <span className="w-20 shrink-0 text-xs text-muted-foreground tabular sm:text-right">
                {item.total_submissions > 0
                  ? `${Number(item.avg_score).toFixed(0)}%`
                  : "—"}
              </span>
              <span className="w-20 shrink-0 sm:text-right">
                <Badge variant={item.is_published ? "success" : "secondary"}>
                  {item.is_published ? "Live" : "Draft"}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between">
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/cases?page=${page - 1}`}>Previous</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground tabular">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/cases?page=${page + 1}`}>Next</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
