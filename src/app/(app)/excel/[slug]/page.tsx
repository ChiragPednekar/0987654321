import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { ExcelWorkbench } from "@/components/excel/excel-workbench";
import { ALLOWED } from "@/lib/excel/functions";

export const metadata: Metadata = { title: "Excel exercise" };

export default async function ExcelExercisePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/excel/${slug}`);

  const admin = createAdminClient();
  // Only the readable columns are selected. hidden_grid and solution_formula
  // are not granted to clients and must never reach a page.
  const { data: exercise } = await admin
    .from("excel_exercises")
    // Deliberately not prompt, grid, answer_label or hint. Those are the
    // exercise; /api/excel/open hands them over once exam mode is armed. A
    // prop rendered here would travel in the page payload and be readable
    // without pressing Start.
    .select("id, title, topic, difficulty")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!exercise) notFound();

  const { data: attempts } = await admin
    .from("excel_attempts")
    .select("formula, correct")
    .eq("user_id", user.id)
    .eq("exercise_id", exercise.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const last = attempts?.[0];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Link href="/excel" className="text-sm text-muted-foreground hover:text-foreground">
        ← Excel practice
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{exercise.title}</h1>
        <Badge variant="outline">{exercise.difficulty}</Badge>
      </div>

      <div className="mt-5">
        {/* The allow-list is passed down rather than imported by the client
            component: importing it there would ship both formula libraries
            to the browser for the sake of a list of names. */}
        <ExcelWorkbench
          slug={slug}
          functions={[...ALLOWED].sort()}
          initialFormula={last?.formula ?? ""}
          alreadySolved={Boolean(last?.correct)}
        />
      </div>
    </div>
  );
}
