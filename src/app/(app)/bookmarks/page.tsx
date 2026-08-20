import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Bookmark, Clock } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookmarkButton } from "@/components/case/bookmark-button";
import { DIFFICULTY_CLASS, DOMAIN_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Difficulty, Domain } from "@/lib/types/database";

export const metadata: Metadata = { title: "Bookmarks" };

type BookmarkJoin = {
  case_id: string;
  created_at: string;
  cases: {
    id: string;
    slug: string;
    title: string;
    domain: string;
    difficulty: string;
    company_track: string | null;
    estimated_minutes: number;
  } | null;
};

export default async function BookmarksPage() {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login?next=/bookmarks");

  const supabase = await createClient();

  const { data } = await supabase
    .from("bookmarks")
    .select(
      "case_id, created_at, cases(id, slug, title, domain, difficulty, company_track, estimated_minutes)",
    )
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  // A bookmarked case that was later unpublished comes back as a null join.
  const rows = ((data ?? []) as unknown as BookmarkJoin[]).filter(
    (row) => row.cases !== null,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bookmarks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length === 0
              ? "Cases you save appear here."
              : `${rows.length} saved ${rows.length === 1 ? "case" : "cases"}.`}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/cases">Browse cases</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card className="mt-6">
          <div className="flex flex-col items-center gap-4 px-4 py-20 text-center">
            <Bookmark className="size-8 text-muted-foreground/50" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Nothing saved yet</p>
              <p className="text-sm text-muted-foreground">
                Hit <span className="font-medium">Save</span> on any case to
                keep it here for later.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/cases">Browse cases</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mt-6 overflow-hidden">
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const c = row.cases!;
              return (
                <li
                  key={row.case_id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/cases/${c.slug}`}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {c.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">
                        {DOMAIN_LABEL[c.domain as Domain]}
                      </Badge>
                      <span
                        className={cn(
                          "font-medium capitalize",
                          DIFFICULTY_CLASS[c.difficulty as Difficulty],
                        )}
                      >
                        {c.difficulty}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {c.estimated_minutes} min
                      </span>
                      {c.company_track && (
                        <Badge variant="outline">{c.company_track}</Badge>
                      )}
                    </div>
                  </div>

                  <BookmarkButton
                    caseId={c.id}
                    initiallySaved
                    signedIn
                    className="shrink-0"
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
