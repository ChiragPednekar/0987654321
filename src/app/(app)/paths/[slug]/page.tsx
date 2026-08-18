import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, Circle, Clock, Lock } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DIFFICULTY_CLASS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/lib/types/database";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("learning_paths")
    .select("title, description")
    .eq("slug", slug)
    .maybeSingle();

  return data
    ? { title: data.title, description: data.description ?? undefined }
    : { title: "Path not found" };
}

export default async function PathDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const profile = await getCurrentUser();

  const { data: path } = await supabase
    .from("learning_paths")
    .select(
      "*, learning_path_steps(id, step_order, title, unlock_threshold, cases(id, slug, title, difficulty, estimated_minutes))",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!path) notFound();

  const steps = [...(path.learning_path_steps ?? [])].sort(
    (a, b) => a.step_order - b.step_order,
  );

  // Best score per case for this user, to decide which steps are cleared.
  const bestByCase = new Map<string, number>();
  if (profile) {
    const { data: best } = await supabase
      .from("user_case_best")
      .select("case_id, percentage")
      .eq("user_id", profile.id);

    for (const row of best ?? []) {
      bestByCase.set(row.case_id, Number(row.percentage));
    }
  }

  // A step unlocks when every earlier step has been cleared.
  const stepState = steps.map((step) => {
    const caseRef = Array.isArray(step.cases) ? step.cases[0] : step.cases;
    const best = caseRef ? bestByCase.get(caseRef.id) : undefined;
    return {
      step,
      caseRef,
      best,
      cleared: best !== undefined && best >= step.unlock_threshold,
    };
  });

  let unlockedUpTo = 0;
  for (const state of stepState) {
    if (state.cleared) unlockedUpTo += 1;
    else break;
  }

  const completed = stepState.filter((s) => s.cleared).length;
  const percentage = steps.length > 0 ? (completed / steps.length) * 100 : 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/paths"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All paths
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{path.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{path.description}</p>

      <div className="mt-6 space-y-2">
        <Progress value={percentage} />
        <p className="text-xs text-muted-foreground tabular">
          {completed} of {steps.length} steps complete
        </p>
      </div>

      <ol className="mt-8 space-y-3">
        {stepState.map(({ step, caseRef, best, cleared }, index) => {
          // Unlocked if it's the next step or earlier, or already cleared.
          const locked = Boolean(profile) && index > unlockedUpTo && !cleared;

          const content = (
            <Card
              className={cn(
                "transition-colors",
                locked ? "opacity-60" : "hover:border-primary/50",
              )}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <span className="shrink-0">
                  {cleared ? (
                    <CheckCircle2 className="size-5 text-[var(--success)]" />
                  ) : locked ? (
                    <Lock className="size-5 text-muted-foreground/50" />
                  ) : (
                    <Circle className="size-5 text-muted-foreground/40" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular">
                      Step {step.step_order}
                    </span>
                    {caseRef && (
                      <span
                        className={cn(
                          "text-xs font-medium capitalize",
                          DIFFICULTY_CLASS[caseRef.difficulty as Difficulty],
                        )}
                      >
                        {caseRef.difficulty}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm font-medium">
                    {caseRef?.title ?? step.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Need {step.unlock_threshold}% to unlock the next step
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {best !== undefined && (
                    <Badge variant={cleared ? "success" : "warning"} className="tabular">
                      {best.toFixed(0)}%
                    </Badge>
                  )}
                  {caseRef && (
                    <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                      <Clock className="size-3" />
                      {caseRef.estimated_minutes}m
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );

          return (
            <li key={step.id}>
              {locked || !caseRef ? (
                content
              ) : (
                <Link href={`/cases/${caseRef.slug}`}>{content}</Link>
              )}
            </li>
          );
        })}
      </ol>

      {steps.length === 0 && (
        <Card className="mt-8">
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              This path has no steps yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
