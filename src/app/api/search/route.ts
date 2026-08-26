import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export interface SearchResult {
  id: string;
  title: string;
  href: string;
  domain?: string;
  difficulty?: string;
}

export interface SearchResponse {
  cases: SearchResult[];
  tracks: SearchResult[];
}

/**
 * Backs the ⌘K palette. Deliberately narrow: cases and skill tracks only,
 * capped tight, because a palette that takes a second to answer is one people
 * stop opening. Static "go to" destinations are matched on the client — they
 * never change and do not deserve a round trip.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json<SearchResponse>({ cases: [], tracks: [] });
  }

  // Escape PostgREST's `or` delimiters before interpolating.
  const safe = q.replace(/[(),*]/g, " ").trim();
  if (!safe) {
    return NextResponse.json<SearchResponse>({ cases: [], tracks: [] });
  }

  // The caller's own client, so RLS decides what is visible. Deliberately NOT
  // filtered to `visibility = 'platform'` the way /cases is: this endpoint also
  // backs the teacher's case picker, which has to reach their own questions.
  // The row policy on `cases` already scopes a private question to its author
  // and its batch, so narrowing here would break assigning your own work
  // without making anything safer.
  const supabase = await createClient();

  const [{ data: cases }, { data: tracks }] = await Promise.all([
    supabase
      .from("cases")
      .select("id, slug, title, domain, difficulty")
      .eq("is_published", true)
      .ilike("title", `%${safe}%`)
      .limit(6),
    supabase
      .from("learning_paths")
      .select("id, slug, title, domain")
      .eq("is_published", true)
      .ilike("title", `%${safe}%`)
      .limit(4),
  ]);

  return NextResponse.json<SearchResponse>({
    cases: (cases ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      href: `/cases/${c.slug}`,
      domain: c.domain,
      difficulty: c.difficulty,
    })),
    tracks: (tracks ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      href: `/paths/${t.slug}`,
      domain: t.domain,
    })),
  });
}
