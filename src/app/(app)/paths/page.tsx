import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DOMAIN_LABEL } from "@/lib/constants";
import type { Domain } from "@/lib/types/database";

export const metadata: Metadata = { title: "Learning paths" };

export default async function PathsPage() {
  const supabase = await createClient();
  const profile = await getCurrentUser();

  const [{ data: paths }, { data: progress }] = await Promise.all([
    supabase
      .from("learning_paths")
      .select("*, learning_path_steps(id)")
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Learning paths</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ordered sequences. Clear a step to unlock the next one.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {(paths ?? []).map((path) => {
          const steps = Array.isArray(path.learning_path_steps)
            ? path.learning_path_steps.length
            : 0;
          const mine = progressByPath.get(path.id);
          const completed = mine?.completed_steps ?? 0;
          const percentage = steps > 0 ? (completed / steps) * 100 : 0;

          return (
            <Link key={path.id} href={`/paths/${path.slug}`}>
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">{path.title}</CardTitle>
                    <Badge variant="secondary">
                      {DOMAIN_LABEL[path.domain as Domain]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {path.description}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={percentage} />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="tabular">
                      {completed} of {steps} steps
                    </span>
                    <span className="flex items-center gap-1 text-foreground">
                      {mine?.completed_at
                        ? "Complete"
                        : completed > 0
                          ? "Continue"
                          : "Start"}
                      <ArrowRight className="size-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {(!paths || paths.length === 0) && (
        <Card className="mt-8">
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No learning paths yet. Run the seed script to create them.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
