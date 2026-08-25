import Link from "next/link";
import type { Metadata } from "next";
import { requireTeacherActor } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DIFFICULTY_CLASS, DOMAIN_LABEL } from "@/lib/constants";
import { cn, formatNumber, timeAgo } from "@/lib/utils";
import type { Difficulty, Domain } from "@/lib/types/database";

export const metadata: Metadata = { title: "Question bank" };

export default async function QuestionBank() {
  const actor = await requireTeacherActor();
  const admin = createAdminClient();

  const [{ data: mine }, { count: platformCount }] = await Promise.all([
    admin
      .from("cases")
      .select("id, slug, title, domain, difficulty, format, is_published, created_at")
      .eq("created_by", actor.id)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("cases")
      .select("id", { count: "exact", head: true })
      .eq("visibility", "platform")
      .eq("is_published", true),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Question bank</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your own questions, plus {formatNumber(platformCount ?? 0)} platform
            cases you can assign as they are.
          </p>
        </div>
        <Button asChild>
          <Link href="/teacher/questions/new">Write a question</Link>
        </Button>
      </div>

      <Card className="mt-6">
        <CardContent className="p-4">
          <p className="text-sm">
            <span className="font-medium">Platform library</span>{" "}
            <span className="text-muted-foreground">
              — {formatNumber(platformCount ?? 0)} cases with rubrics, hints and
              worked answers, ready to assign.
            </span>
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href="/cases">Browse the library</Link>
          </Button>
        </CardContent>
      </Card>

      <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Your questions
      </h2>

      {!mine || mine.length === 0 ? (
        <Card className="mt-3">
          <CardContent className="p-6 text-sm text-muted-foreground">
            You have not written any questions yet. Yours stay private to the
            batch you write them for — they never appear in the public library.
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-3 space-y-2">
          {mine.map((q) => (
            <li
              key={q.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
            >
              <span className="font-medium">{q.title}</span>
              <Badge variant="outline">{DOMAIN_LABEL[q.domain as Domain]}</Badge>
              <span className={cn("text-xs", DIFFICULTY_CLASS[q.difficulty as Difficulty])}>
                {q.difficulty}
              </span>
              <span className="text-xs text-muted-foreground">{q.format}</span>
              {!q.is_published ? <Badge variant="outline">Draft</Badge> : null}
              <span className="ml-auto text-xs text-muted-foreground">
                {timeAgo(q.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
