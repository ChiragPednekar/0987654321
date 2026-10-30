import Link from "next/link";
import type { Metadata } from "next";
import { requireTeacherActor } from "@/lib/authz";
import { createAdminClient } from "@/lib/supabase/admin";
import { Note, Section, SectionEmpty, SectionList } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DIFFICULTY_CLASS, DOMAIN_LABEL } from "@/lib/constants";
import { cn, formatNumber, timeAgo } from "@/lib/utils";
import type { Difficulty, Domain } from "@/lib/types/database";
import { PickToggle } from "@/components/teacher/library-picker";
import { OBJECTIVE_TRACKS } from "@/lib/objective";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Question bank" };

export default async function QuestionBank() {
  const actor = await requireTeacherActor();
  const admin = createAdminClient();

  const [
    { data: mine },
    { count: platformCount },
    { data: myAptitude },
    { data: mySql },
    { data: myExcel },
  ] = await Promise.all([
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
    admin
      .from("objective_questions")
      .select("id, track, topic, difficulty, stem, created_at")
      .eq("created_by", actor.id)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("sql_exercises")
      .select("id, slug, title, topic, difficulty, created_at")
      .eq("created_by", actor.id)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("excel_exercises")
      .select("id, slug, title, topic, difficulty, created_at")
      .eq("created_by", actor.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const myExercises = [
    ...(mySql ?? []).map((e) => ({ ...e, kind: "sql" as const })),
    ...(myExcel ?? []).map((e) => ({ ...e, kind: "excel" as const })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const trackLabel = new Map(OBJECTIVE_TRACKS.map((t) => [t.value, t.label]));

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Question bank"
        subtitle={<>Your own questions, plus {formatNumber(platformCount ?? 0)} platform cases you can assign as they are.</>}
        actions={
          <>
            <Button asChild>
              <Link href="/teacher/questions/new">Add a question</Link>
            </Button>
          </>
        }
      />

      <Note className="mt-6" title={`Platform library — ${formatNumber(platformCount ?? 0)} cases with rubrics, hints and worked answers`}>
        Tick anything in the library — cases, paths, SQL, Excel or aptitude
        questions — and use &ldquo;Add to batch&rdquo; to assign it.{" "}
        <Link href="/cases" className="text-foreground underline underline-offset-4">
          Browse the library
        </Link>
      </Note>

      <Section
        title="Your cases and written questions"
        count={mine?.length ?? 0}
        description="Private to you and the batches you assign them to — never in the public library."
      >
        {!mine || mine.length === 0 ? (
          <SectionEmpty>
            None yet.{" "}
            <Link href="/teacher/questions/new" className="underline underline-offset-4">
              Write a case
            </Link>
            .
          </SectionEmpty>
        ) : (
          <SectionList>
            {mine.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-3 py-3">
                {q.is_published ? <PickToggle kind="case" id={q.id} title={q.title} /> : null}
                <Link href={`/cases/${q.slug}`} className="font-medium hover:underline">{q.title}</Link>
                <Badge variant="outline">{DOMAIN_LABEL[q.domain as Domain]}</Badge>
                <span className={cn("text-xs", DIFFICULTY_CLASS[q.difficulty as Difficulty])}>
                  {q.difficulty}
                </span>
                <span className="text-xs text-muted-foreground">{q.format}</span>
                {!q.is_published ? <Badge variant="outline">Draft</Badge> : null}
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {timeAgo(q.created_at)}
                </span>
              </li>
            ))}
          </SectionList>
        )}
      </Section>

      <Section title="Your aptitude questions" count={myAptitude?.length ?? 0}>
        {!myAptitude || myAptitude.length === 0 ? (
          <SectionEmpty>
            None yet.{" "}
            <Link href="/teacher/questions/new?type=aptitude" className="underline underline-offset-4">
              Add an aptitude question
            </Link>{" "}
            and tick it — with any platform questions — into a quiz for a batch.
          </SectionEmpty>
        ) : (
          <SectionList>
            {myAptitude.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-3 py-3">
                <PickToggle
                  kind="aptitude"
                  id={q.id}
                  title={q.stem.length > 90 ? `${q.stem.slice(0, 87)}…` : q.stem}
                />
                <span className="min-w-0 flex-1 truncate">{q.stem}</span>
                <Badge variant="outline">{trackLabel.get(q.track) ?? q.track}</Badge>
                <span className={cn("text-xs", DIFFICULTY_CLASS[q.difficulty as Difficulty])}>
                  {q.difficulty}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{timeAgo(q.created_at)}</span>
              </li>
            ))}
          </SectionList>
        )}
      </Section>

      <Section title="Your SQL and Excel exercises" count={myExercises.length}>
        {myExercises.length === 0 ? (
          <SectionEmpty>
            None yet. Write an{" "}
            <Link href="/teacher/questions/new?type=sql" className="underline underline-offset-4">
              SQL exercise
            </Link>{" "}
            or an{" "}
            <Link href="/teacher/questions/new?type=excel" className="underline underline-offset-4">
              Excel exercise
            </Link>
            , on the platform&apos;s data or your own.
          </SectionEmpty>
        ) : (
          <SectionList>
            {myExercises.map((e) => (
              <li key={`${e.kind}:${e.id}`} className="flex flex-wrap items-center gap-3 py-3">
                <PickToggle kind={e.kind} id={e.id} title={e.title} />
                <Link href={`/${e.kind}/${e.slug}`} className="font-medium hover:underline">{e.title}</Link>
                <Badge variant="outline">{e.kind === "sql" ? "SQL" : "Excel"}</Badge>
                <span className={cn("text-xs", DIFFICULTY_CLASS[e.difficulty as Difficulty])}>
                  {e.difficulty}
                </span>
                <span className="text-xs text-muted-foreground">{e.topic}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{timeAgo(e.created_at)}</span>
              </li>
            ))}
          </SectionList>
        )}
      </Section>
    </div>
  );
}
