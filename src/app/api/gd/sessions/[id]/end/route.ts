import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateGroupDiscussion, GD_MAX_SCORE } from "@/lib/ai/gd-evaluate";
import { recordUsage } from "@/lib/usage";
import type { GdScoreRow } from "@/lib/types/database";

// One model call for the whole room, but the transcript can be long.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * Ends a discussion and marks everyone in it.
 *
 * Idempotent by status: the first caller flips the room to `completed` and
 * grades, and everyone else's "end" — six people all clicking at once as the
 * timer runs out — finds it already completed and returns the existing
 * scores rather than paying for a second grading of the same transcript.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();

  const { data: member } = await admin
    .from("gd_participants")
    .select("user_id")
    .eq("session_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "You are not in this room." }, { status: 403 });
  }

  // Claim the grading. `.eq("status", ...)` on the update makes this a
  // compare-and-set: exactly one concurrent caller gets a row back.
  const { data: claimed } = await admin
    .from("gd_sessions")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["open", "live"])
    .select("id, topic_id")
    .maybeSingle();

  if (!claimed) {
    const { data: existing } = await admin
      .from("gd_scores")
      .select("*")
      .eq("session_id", id);
    return NextResponse.json({ already_graded: true, scores: existing ?? [] });
  }

  const [{ data: topic }, { data: participants }, { data: utterances }] =
    await Promise.all([
      admin.from("gd_topics").select("title, prompt").eq("id", claimed.topic_id).maybeSingle(),
      admin
        .from("gd_participants")
        .select("user_id, transcription_ok, users(full_name, email)")
        .eq("session_id", id),
      admin
        .from("gd_utterances")
        .select("user_id, text, said_at")
        .eq("session_id", id)
        .order("said_at", { ascending: true }),
    ]);

  const people = participants ?? [];
  const lines = utterances ?? [];

  /**
   * Labels for the transcript.
   *
   * Real names are used rather than "Participant 1", because the model marks
   * collaboration partly on whether people addressed each other by name, and
   * that signal is destroyed by anonymising. Duplicates are disambiguated so
   * two students called Priya do not collapse into one speaker.
   */
  const labelOf = new Map<string, string>();
  const used = new Set<string>();
  for (const p of people) {
    const u = Array.isArray(p.users) ? p.users[0] : p.users;
    const base = (u?.full_name || u?.email?.split("@")[0] || "Participant").trim();
    let label = base;
    let n = 2;
    while (used.has(label)) label = `${base} (${n++})`;
    used.add(label);
    labelOf.set(p.user_id, label);
  }

  const spokenWords = new Map<string, number>();
  for (const line of lines) {
    spokenWords.set(
      line.user_id,
      (spokenWords.get(line.user_id) ?? 0) + line.text.trim().split(/\s+/).length,
    );
  }

  /**
   * Who can be marked at all.
   *
   * A participant with no transcript is never sent to the model and never
   * scored, and the reason is recorded separately: `not_transcribed` when
   * their browser could not hear them, `silent` when it could and they said
   * nothing. Collapsing those two into a zero would tell a student who spoke
   * well on Safari that they contributed nothing.
   */
  const scorable = people.filter((p) => (spokenWords.get(p.user_id) ?? 0) > 0);
  const unscorable = people.filter((p) => (spokenWords.get(p.user_id) ?? 0) === 0);

  const rows: Partial<GdScoreRow>[] = unscorable.map((p) => ({
    session_id: id,
    user_id: p.user_id,
    breakdown: {},
    total: 0,
    max_score: GD_MAX_SCORE,
    outcome: p.transcription_ok ? "silent" : "not_transcribed",
    words_spoken: 0,
    feedback: {
      verdict: p.transcription_ok
        ? "You did not speak in this discussion, so there is nothing to mark. Entering once in the first two minutes is the single highest-value habit in a GD."
        : "Your browser could not transcribe your speech, so this discussion could not be marked for you. Chrome or Edge on a laptop will work. This is not a reflection of how you did.",
    },
  }));

  if (scorable.length > 0) {
    try {
      const evaluation = await evaluateGroupDiscussion(
        topic?.title ?? "Group discussion",
        topic?.prompt ?? "",
        scorable.map((p) => labelOf.get(p.user_id)!),
        lines.map((l) => ({
          speaker: labelOf.get(l.user_id) ?? "Unknown",
          text: l.text,
        })),
      );

      // Per-operation accounting, as with case grading. Attributed to whoever
      // ended the room; the cost is one call shared by everyone in it.
      void recordUsage(admin, {
        userId: user.id,
        operation: "grading",
        model: evaluation.model,
        inputTokens: evaluation.inputTokens,
        outputTokens: evaluation.outputTokens,
        cachedTokens: evaluation.cachedTokens,
        totalTokens: evaluation.tokensUsed,
      });

      const byLabel = new Map(evaluation.results.map((r) => [r.speaker, r]));

      for (const p of scorable) {
        const label = labelOf.get(p.user_id)!;
        const r = byLabel.get(label);
        rows.push({
          session_id: id,
          user_id: p.user_id,
          breakdown: r?.breakdown ?? {},
          total: r?.total ?? 0,
          max_score: GD_MAX_SCORE,
          outcome: "scored" as const,
          words_spoken: spokenWords.get(p.user_id) ?? 0,
          feedback: {
            strengths: r?.strengths ?? [],
            weaknesses: r?.weaknesses ?? [],
            verdict: r?.verdict ?? "",
          },
        });
      }
    } catch (error) {
      console.error("[gd] evaluation failed", error);
      // The room is already marked completed, so leaving without scores would
      // strand it permanently. Reopen it so the grading can be retried rather
      // than losing a discussion six people just spent ten minutes on.
      await admin
        .from("gd_sessions")
        .update({ status: "live", ended_at: null })
        .eq("id", id);
      return NextResponse.json(
        { error: "Could not mark the discussion. Try ending it again." },
        { status: 500 },
      );
    }
  }

  if (rows.length > 0) {
    const { error } = await admin.from("gd_scores").upsert(rows, {
      onConflict: "session_id,user_id",
    });
    if (error) console.error("[gd] score insert failed", error.message);
  }

  return NextResponse.json({ ok: true, scored: rows.length });
}
