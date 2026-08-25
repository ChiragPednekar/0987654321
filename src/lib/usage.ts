import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { MODEL_RATES } from "@/lib/constants";
import type { Database } from "@/lib/types/database";

/**
 * Per-operation AI accounting.
 *
 * Cost used to be reconstructed after the fact by apportioning a single total
 * token count 80/20 between input and output. That was a defensible guess, but
 * the owner's margin view should not rest on a guess — so every AI call now
 * records what the provider actually reported, priced at the rates in force at
 * the time. A later price change restates nothing.
 *
 * Recording must never be able to fail the operation that caused it. A student
 * whose answer was graded should not see an error because a metrics row would
 * not insert.
 */

type Admin = SupabaseClient<Database>;

export interface UsageEvent {
  userId: string;
  operation: "grading" | "interview";
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  /** Some providers report only a total; pass it when the split is unknown. */
  totalTokens?: number;
}

/** Rupees, from Google's published per-million rates. */
export function priceUsage(inputTokens: number, outputTokens: number): number {
  const usd =
    (inputTokens / 1e6) * MODEL_RATES.inputPerMillionUsd +
    (outputTokens / 1e6) * MODEL_RATES.outputPerMillionUsd;
  return usd * MODEL_RATES.usdInr;
}

/**
 * Splits a provider-reported total when the input/output breakdown is missing.
 *
 * 80/20 matches the measured shape of a real grading call (5,271 in / 1,126
 * out). Only used as a fallback — providers that report the split get the real
 * numbers, and this exists so an unknown provider still produces a usable cost
 * rather than a zero.
 */
export function splitTotal(total: number): { input: number; output: number } {
  return { input: Math.round(total * 0.8), output: Math.round(total * 0.2) };
}

export async function recordUsage(admin: Admin, event: UsageEvent): Promise<void> {
  try {
    let input = event.inputTokens;
    let output = event.outputTokens;

    if (!input && !output && event.totalTokens) {
      const split = splitTotal(event.totalTokens);
      input = split.input;
      output = split.output;
    }

    // Denormalised at write time: a student can leave an institution later, and
    // the cost their usage caused still belongs to that contract.
    const { data: membership } = await admin
      .from("institution_members")
      .select("institution_id")
      .eq("user_id", event.userId)
      .maybeSingle();

    await admin.from("usage_events").insert({
      user_id: event.userId,
      institution_id: membership?.institution_id ?? null,
      operation: event.operation,
      model: event.model,
      input_tokens: input,
      output_tokens: output,
      total_tokens: event.totalTokens ?? input + output,
      cost_inr: priceUsage(input, output),
    });
  } catch {
    // Deliberately swallowed. Metrics are not worth failing a graded submission
    // or an interview turn over; the submission and score rows remain the
    // record of what happened either way.
  }
}
