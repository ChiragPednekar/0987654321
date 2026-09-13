import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ObjectiveRunner } from "@/components/practice/objective-runner";
import { OBJECTIVE_TRACKS } from "@/lib/objective";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ track: string }>;
}): Promise<Metadata> {
  const { track } = await params;
  const meta = OBJECTIVE_TRACKS.find((t) => t.value === track);
  return { title: meta?.label ?? "Practice" };
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ track: string }>;
}) {
  const { track } = await params;
  const meta = OBJECTIVE_TRACKS.find((t) => t.value === track);
  if (!meta) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/practice/${track}`);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/practice"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All practice
      </Link>
      <div className="mt-4">
        <ObjectiveRunner track={meta} />
      </div>
    </div>
  );
}
