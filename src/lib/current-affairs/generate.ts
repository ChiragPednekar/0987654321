import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { draftQuestions } from "@/lib/ai/current-affairs";
import { recordUsage } from "@/lib/usage";
import { SOURCES, isRoutine, newsworthiness, parseRbiFeed } from "./feed";
import { QUIZ_SIZE, checkDrafts, istDate, type Rejection } from "./questions";

type Admin = SupabaseClient<Database>;

/** How far back a release can still make a quiz. Long enough to carry Friday's news over a weekend. */
const LOOKBACK_DAYS = 4;
/** Releases offered to the model in one call. */
const MAX_CANDIDATES = 6;

export type GenerationStatus =
  | "published"
  | "already_published"
  | "no_new_releases"
  | "too_few_questions"
  | "failed";

export interface GenerationReport {
  quiz_date: string;
  status: GenerationStatus;
  feed: { fetched: boolean; items: number; error?: string };
  candidates: string[];
  accepted: number;
  rejected: Rejection[];
  error?: string;
}

async function fetchFeed(): Promise<{ xml: string | null; error?: string }> {
  try {
    const response = await fetch(SOURCES.rbi.feedUrl, {
      headers: { "user-agent": "CaseCode daily quiz (+https://mableetcode.vercel.app)" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) return { xml: null, error: `feed returned ${response.status}` };
    return { xml: await response.text() };
  } catch (error) {
    return { xml: null, error: error instanceof Error ? error.message : "feed fetch failed" };
  }
}

/**
 * Stores today's releases and, if today has no quiz, writes one.
 *
 * Safe to run repeatedly: releases are keyed by URL, quizzes by Indian date,
 * and a day that already has a quiz returns before any model call. A feed that
 * cannot be reached is not fatal — releases stored on earlier runs are still
 * within the lookback window.
 *
 * On a day with too little news it publishes nothing rather than padding. The
 * page falls back to the most recent quiz, and a day with no quiz cannot break
 * anyone's streak.
 */
export async function runDailyQuiz(admin: Admin, now: Date = new Date()): Promise<GenerationReport> {
  const quizDate = istDate(now);
  const report: GenerationReport = {
    quiz_date: quizDate,
    status: "failed",
    feed: { fetched: false, items: 0 },
    candidates: [],
    accepted: 0,
    rejected: [],
  };

  const feed = await fetchFeed();
  if (feed.xml) {
    const items = parseRbiFeed(feed.xml);
    report.feed = { fetched: true, items: items.length };
    if (items.length > 0) {
      const { error } = await admin.from("ca_source_items").upsert(
        items.map((i) => ({
          source: i.source,
          url: i.url,
          title: i.title,
          published_at: i.publishedAt,
          body: i.body,
        })),
        // First sighting wins: a release is not re-stamped every morning.
        { onConflict: "url", ignoreDuplicates: true },
      );
      if (error) console.error("[daily-quiz] could not store releases", error);
    }
  } else {
    report.feed = { fetched: false, items: 0, error: feed.error };
    console.error("[daily-quiz] feed unavailable", feed.error);
  }

  const { data: existing } = await admin
    .from("ca_quizzes")
    .select("id")
    .eq("quiz_date", quizDate)
    .maybeSingle();
  if (existing) {
    report.status = "already_published";
    return report;
  }

  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const [{ data: recent }, { data: used }] = await Promise.all([
    admin
      .from("ca_source_items")
      .select("id, source, title, published_at, body")
      .gte("published_at", since)
      .order("published_at", { ascending: false })
      .limit(60),
    admin.from("ca_questions").select("source_item_id"),
  ]);

  // A release already asked about is not asked about again the next morning.
  const usedIds = new Set((used ?? []).map((q) => q.source_item_id));
  const candidates = (recent ?? [])
    .filter((item) => !usedIds.has(item.id) && !isRoutine(item))
    .sort(
      (a, b) =>
        newsworthiness({ title: b.title, publishedAt: b.published_at }) -
          newsworthiness({ title: a.title, publishedAt: a.published_at }) ||
        b.published_at.localeCompare(a.published_at),
    )
    .slice(0, MAX_CANDIDATES);

  report.candidates = candidates.map((c) => c.title);
  if (candidates.length === 0) {
    report.status = "no_new_releases";
    return report;
  }

  let call;
  try {
    call = await draftQuestions(
      candidates.map((c) => ({
        title: c.title,
        publishedAt: c.published_at,
        body: c.body,
        sourceLabel: SOURCES[c.source].label,
      })),
    );
  } catch (error) {
    report.error = error instanceof Error ? error.message : "model call failed";
    console.error("[daily-quiz] drafting failed", error);
    return report;
  }

  void recordUsage(admin, {
    userId: null,
    operation: "content",
    model: call.model,
    inputTokens: call.inputTokens,
    outputTokens: call.outputTokens,
    cachedTokens: call.cachedTokens,
    totalTokens: call.tokensUsed,
  });

  const { accepted, rejected } = checkDrafts(
    call.drafts,
    candidates.map((c) => c.body),
  );
  report.accepted = accepted.length;
  report.rejected = rejected;
  if (rejected.length > 0) console.warn("[daily-quiz] rejected drafts", rejected);

  if (accepted.length < QUIZ_SIZE.minimum) {
    report.status = "too_few_questions";
    return report;
  }

  const { data: quiz, error: quizError } = await admin
    .from("ca_quizzes")
    .insert({ quiz_date: quizDate, model: call.model })
    .select("id")
    .single();

  if (quizError || !quiz) {
    // A concurrent run got there first; its quiz stands.
    if (quizError?.code === "23505") {
      report.status = "already_published";
      return report;
    }
    report.error = quizError?.message ?? "could not create quiz";
    return report;
  }

  const { error: questionsError } = await admin.from("ca_questions").insert(
    accepted.map((q, position) => ({
      quiz_id: quiz.id,
      position,
      stem: q.stem,
      options: q.options,
      correct_index: q.correctIndex,
      explanation: q.explanation,
      evidence: q.evidence,
      source_item_id: candidates[q.itemIndex].id,
    })),
  );

  if (questionsError) {
    // Never leave an empty quiz standing for the day.
    await admin.from("ca_quizzes").delete().eq("id", quiz.id);
    report.error = questionsError.message;
    return report;
  }

  report.status = "published";
  return report;
}
