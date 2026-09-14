import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assessPersonalInterview } from "@/lib/ai/pi-interview";
import { PI_MAX_SCORE } from "@/lib/pi";
import { recordUsage } from "@/lib/usage";
import { RateLimitError } from "@/lib/ai/errors";
import { z } from "zod";
import { signalsSchema } from "@/lib/integrity-request";
import { recordActivityIntegrity } from "@/lib/proctoring";
import { EMPTY_SIGNALS } from "@/lib/integrity";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * Ends an interview and assesses it.
 *
 * Claimed with a compare-and-set on status so a double click — or a student
 * hitting finish while the last reply is still in flight — cannot pay for two
 * assessments of the same transcript.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  /**
   * Tolerant on purpose. This route used to be called with no body at all, and
   * a tab left open across the deploy will still call it that way. A missing
   * or malformed payload means no signals were reported, which assessIntegrity
   * treats as an absence of evidence rather than as evidence.
   */
  const signals = await request
    .json()
    .then((raw) => z.object({ signals: signalsSchema }).parse(raw).signals)
    .catch(() => EMPTY_SIGNALS);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();

  const { data: session } = await admin
    .from("pi_sessions")
    .select("id, user_id, kind, status")
    .eq("id", id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Not your interview." }, { status: 403 });
  }
  if (session.status === "completed") {
    return NextResponse.json({ already_assessed: true });
  }

  const { data: history } = await admin
    .from("pi_messages")
    .select("role, content")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  const turns = history ?? [];
  const answered = turns.filter((t) => t.role === "candidate").length;
  // Only the candidate's own words. Including the interviewer's questions
  // would inflate the denominator and make every answer look under-typed.
  const candidateChars = turns
    .filter((t) => t.role === "candidate")
    .reduce((total, t) => total + (t.content?.length ?? 0), 0);

  // Nothing to assess. Closed rather than graded, and said plainly — a score
  // out of 100 on an interview the candidate never answered would be noise
  // presented as a judgement.
  if (answered === 0) {
    await admin
      .from("pi_sessions")
      .update({ status: "abandoned", ended_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({
      abandoned: true,
      error: "You did not answer any questions, so there is nothing to assess.",
    });
  }

  const { data: claimed } = await admin
    .from("pi_sessions")
    .update({ status: "completed", ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "live")
    .select("id")
    .maybeSingle();

  if (!claimed) return NextResponse.json({ already_assessed: true });

  try {
    const assessment = await assessPersonalInterview(
      session.kind,
      turns.map((t) => ({ role: t.role, content: t.content })),
    );

    void recordUsage(admin, {
      userId: user.id,
      operation: "interview",
      model: assessment.model,
      inputTokens: assessment.inputTokens,
      outputTokens: assessment.outputTokens,
      cachedTokens: assessment.cachedTokens,
      totalTokens: assessment.tokensUsed,
    });

    await admin
      .from("pi_sessions")
      .update({
        breakdown: assessment.breakdown,
        total: assessment.total,
        max_score: PI_MAX_SCORE,
        feedback: {
          strengths: assessment.strengths,
          weaknesses: assessment.weaknesses,
          verdict: assessment.verdict,
        },
      })
      .eq("id", id);

    /**
     * One verdict for the whole interview.
     *
     * Recorded after the assessment is stored, so a failure here can never
     * cost a student the interview they already sat. Unlike the quiz and the
     * workbenches this surface DOES have prose — an interview answer is
     * exactly what a chat window will write for you — but the model that
     * grades a PI does not return an ai_likelihood, so none is passed rather
     * than one being invented. What is recorded is how the answers were
     * typed and whether the page was left.
     */
    const integrity = await recordActivityIntegrity(admin, {
      userId: user.id,
      activity: "interview",
      activityRef: id,
      signals,
      answerChars: candidateChars,
    });

    return NextResponse.json({
      ok: true,
      total: assessment.total,
      max: PI_MAX_SCORE,
      integrity_warning: integrity.warning,
    });
  } catch (err) {
    console.error("[pi] assessment failed", err);

    /**
     * Reopened before anything else, including the rate-limit branch.
     *
     * The session was already flipped to `completed` to claim the grading, so
     * returning without undoing that would strand a finished interview with no
     * assessment and no way to ask for one. A rate limit is the most likely
     * failure here — Gemini's free tier allows five calls a minute and an
     * interview spends one per question — and it is precisely the case where
     * the student will retry, so it must be the case that works.
     */
    await admin
      .from("pi_sessions")
      .update({ status: "live", ended_at: null })
      .eq("id", id);

    if (err instanceof RateLimitError) {
      const wait = err.retryAfterSeconds;
      return NextResponse.json(
        {
          error: wait
            ? `The AI is busy right now. Wait about ${wait} seconds and finish again — your interview is saved.`
            : "The AI is busy right now. Wait a moment and finish again — your interview is saved.",
          code: "rate_limited",
          retry_after_seconds: wait,
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "Could not assess the interview. Try finishing again." },
      { status: 500 },
    );
  }
}
