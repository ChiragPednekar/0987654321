import type { Metadata } from "next";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Page, PageHeader } from "@/components/page-header";
import { TrackCard } from "@/components/track-card";
import { EmptyState } from "@/components/empty-state";
import { domainIllustration } from "@/components/illustrations";
import { PickToggle } from "@/components/teacher/library-picker";
import { PickHint } from "@/components/teacher/pick-hint";

export const metadata: Metadata = { title: "Paths" };

export default async function PathsPage() {
  const supabase = await createClient();
  const profile = await getCurrentUser();
  // A teacher can add a whole path to a batch: one assignment per step.
  const canAssign = profile?.role === "teacher" || profile?.role === "admin";

  const [{ data: paths }, { data: progress }] = await Promise.all([
    supabase
      .from("learning_paths")
      .select("*, learning_path_steps(id, step_order, cases(slug, title))")
      .eq("is_published", true)
      .order("sort_order"),
    profile
      ? supabase
          .from("user_path_progress")
          .select("path_id, completed_steps, current_step, completed_at")
          .eq("user_id", profile.id)
      : Promise.resolve({ data: [] }),
  ]);

  const progressByPath = new Map(
    (progress ?? []).map((row) => [row.path_id, row]),
  );

  const list = paths ?? [];
  const finished = list.filter((p) => progressByPath.get(p.id)?.completed_at).length;
  const stepTotal = list.reduce(
    (sum, p) => sum + (Array.isArray(p.learning_path_steps) ? p.learning_path_steps.length : 0),
    0,
  );

  return (
    <Page>
      <PageHeader
        eyebrow="Practise"
        title="Paths"
        subtitle="Ordered sequences of cases. Clear a step to unlock the next one."
        stats={[
          { value: list.length, label: list.length === 1 ? "path" : "paths" },
          { value: stepTotal, label: "steps" },
          ...(profile ? [{ value: finished, label: "finished" }] : []),
        ]}
      />
      {canAssign && <PickHint noun="paths (each step becomes a case assignment)" />}

      {list.length === 0 ? (
        <EmptyState
          className="mt-8"
          illustration="issueTree"
          title="No paths yet"
          description="Paths appear here once they're published."
        />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((path) => {
            const steps = (Array.isArray(path.learning_path_steps) ? path.learning_path_steps : []) as {
              id: string;
              step_order: number;
              cases: { slug: string; title: string } | { slug: string; title: string }[] | null;
            }[];
            const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
            const mine = progressByPath.get(path.id);
            const completed = Math.min(mine?.completed_steps ?? 0, ordered.length);
            const nextStep = mine?.completed_at ? undefined : ordered[completed];
            const nextCase = nextStep ? (Array.isArray(nextStep.cases) ? nextStep.cases[0] : nextStep.cases) : null;

            return (
              <TrackCard
                key={path.id}
                href={`/paths/${path.slug}`}
                title={path.title}
                description={path.description ?? undefined}
                illustration={domainIllustration(path.domain)}
                solved={completed}
                total={ordered.length}
                next={nextCase ? { title: nextCase.title, href: `/paths/${path.slug}` } : undefined}
                action={
                  canAssign ? (
                    <PickToggle kind="path" id={path.id} title={`${path.title} (${ordered.length} steps)`} />
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}
    </Page>
  );
}
