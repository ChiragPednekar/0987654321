import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { scoreAttempt } from "./questions";

type Admin = SupabaseClient<Database>;

export interface ReviewQuestion {
  position: number;
  stem: string;
  options: string[];
  chosen: number;
  correctIndex: number;
  explanation: string;
  evidence: string;
  isPulled: boolean;
  source: { title: string; url: string; publishedAt: string } | null;
}

export interface QuizReview {
  score: { correct: number; total: number };
  questions: ReviewQuestion[];
}

/**
 * The answer key for one quiz, joined to a student's answers.
 *
 * Only ever called once an attempt exists — by the submit route right after
 * recording it, and by the page when the attempt was already there. That is the
 * whole of the protection on correct_index, explanation and evidence, which the
 * database withholds from clients by grant.
 */
export async function loadReview(admin: Admin, quizId: string, answers: number[]): Promise<QuizReview> {
  const { data: questions } = await admin
    .from("ca_questions")
    .select("position, stem, options, correct_index, explanation, evidence, is_pulled, source_item_id")
    .eq("quiz_id", quizId)
    .order("position");

  const rows = questions ?? [];
  const sourceIds = [...new Set(rows.map((q) => q.source_item_id))];
  const { data: sources } = sourceIds.length
    ? await admin.from("ca_source_items").select("id, title, url, published_at").in("id", sourceIds)
    : { data: [] };
  const sourceOf = new Map((sources ?? []).map((s) => [s.id, s]));

  return {
    score: scoreAttempt(answers, rows),
    questions: rows.map((q) => {
      const source = sourceOf.get(q.source_item_id);
      return {
        position: q.position,
        stem: q.stem,
        options: q.options,
        chosen: answers[q.position] ?? -1,
        correctIndex: q.correct_index,
        explanation: q.explanation,
        evidence: q.evidence,
        isPulled: q.is_pulled,
        source: source ? { title: source.title, url: source.url, publishedAt: source.published_at } : null,
      };
    }),
  };
}
