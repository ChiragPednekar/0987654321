import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ExpertRow } from "@/lib/types/database";
import { EXPERT_PRICE_RANGE_PAISE } from "@/lib/pricing";

type Admin = SupabaseClient<Database>;

/**
 * Paid mock interviews with experts (migration 071).
 *
 * Anyone with an account can apply to be an expert; an admin approves them.
 * An approved expert publishes time slots, a student pays for one, and after
 * the session the expert writes feedback. CaseCode keeps a commission
 * (EXPERT_COMMISSION_BPS) and pays the rest out — payouts are recorded by an
 * admin, outside the app, for now.
 *
 * The session itself happens on the expert's own meeting link (Meet, Zoom),
 * shown to the student only once they have booked.
 */

export const EXPERTISE = [
  "Consulting case interviews",
  "Investment banking",
  "Private equity & VC",
  "Corporate finance",
  "Product management",
  "Marketing & brand",
  "Operations & supply chain",
  "Fit & HR interviews",
] as const;

const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .url()
  .refine((u) => u.startsWith("https://"), "Use an https:// link.");

export const expertProfileSchema = z.object({
  display_name: z.string().trim().min(2).max(80),
  headline: z.string().trim().min(5).max(140),
  bio: z.string().trim().max(2000).default(""),
  expertise: z.array(z.enum(EXPERTISE)).min(1).max(5),
  linkedin_url: httpsUrl.nullable().optional(),
  meeting_url: httpsUrl.nullable().optional(),
  price_rupees: z
    .number()
    .int()
    .min(EXPERT_PRICE_RANGE_PAISE.min / 100)
    .max(EXPERT_PRICE_RANGE_PAISE.max / 100),
});

export type ExpertProfileInput = z.infer<typeof expertProfileSchema>;

export async function expertForUser(admin: Admin, userId: string): Promise<ExpertRow | null> {
  const { data } = await admin.from("experts").select("*").eq("user_id", userId).maybeSingle();
  return (data as ExpertRow | null) ?? null;
}

/** A slot is free when nobody holds it, or the hold has lapsed. */
export function slotIsFree(slot: { status: string; held_until: string | null }, now = new Date()) {
  if (slot.status === "open") return true;
  return slot.status === "held" && !!slot.held_until && new Date(slot.held_until) < now;
}

/** Slots must be booked this far ahead; the earliest bookable start, now. */
export const BOOKING_LEAD_HOURS = 3;
export function bookableFrom(): string {
  return new Date(Date.now() + BOOKING_LEAD_HOURS * 3_600_000).toISOString();
}

/** A day ago — how far back the dashboard still shows slots. */
export function dayAgo(): string {
  return new Date(Date.now() - 86_400_000).toISOString();
}

/** Whether a slot's start time has passed. */
export function hasStarted(iso: string | undefined): boolean {
  return iso ? new Date(iso).getTime() <= Date.now() : false;
}

export function formatSlot(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}
