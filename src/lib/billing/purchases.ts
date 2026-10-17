import "server-only";

import crypto from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, PurchaseKind, PurchaseRow } from "@/lib/types/database";
import {
  PLANS,
  TOPUPS,
  TOPUP_VALID_DAYS,
  rupees,
  splitExpertPrice,
  type PlanCode,
  type TopupCode,
} from "@/lib/pricing";
import { activatePlanPeriod, getAccess, purchaseBlock } from "@/lib/subscription";
import { BOOKING_LEAD_HOURS } from "@/lib/experts";

type Admin = SupabaseClient<Database>;

/**
 * Everything a student can buy goes through here: plans, top-up packs,
 * certificate exam attempts and expert mock interviews.
 *
 * Two rules:
 *   1. The browser names WHAT it wants, never what it costs. The amount is
 *      resolved on the server from src/lib/pricing.ts or from the exam / slot
 *      row being bought.
 *   2. A purchase is fulfilled once. fulfilPurchase() moves the row from
 *      'created' to 'paid' with a conditional update, and only the caller that
 *      wins that update delivers the goods — so the browser's verify call and
 *      Razorpay's webhook, which usually both arrive, cannot double-credit.
 */

export const itemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("plan"), code: z.enum(["monthly", "season", "annual"]) }),
  z.object({ kind: z.literal("topup"), code: z.enum(["answers_25", "interviews_10", "combo"]) }),
  z.object({ kind: z.literal("exam"), slug: z.string().min(1).max(120) }),
  z.object({
    kind: z.literal("expert_session"),
    slotId: z.string().uuid(),
    notes: z.string().max(1500).default(""),
  }),
]);

export type PurchaseItem = z.infer<typeof itemSchema>;

export interface ResolvedItem {
  kind: PurchaseKind;
  itemCode: string;
  itemRef: string | null;
  description: string;
  amountPaise: number;
  meta: Record<string, unknown>;
}

export type Resolution = { ok: true; item: ResolvedItem } | { ok: false; status: number; error: string };

/** How long a slot is held for someone at the checkout. */
const SLOT_HOLD_MINUTES = 15;

/**
 * Prices an item and checks this account may buy it. For an expert session it
 * also holds the slot, so two students cannot pay for the same hour.
 */
export async function resolveItem(admin: Admin, userId: string, item: PurchaseItem): Promise<Resolution> {
  switch (item.kind) {
    case "plan": {
      const plan = PLANS[item.code as PlanCode];
      const blocked = purchaseBlock(await getAccess(admin, userId));
      if (blocked) return { ok: false, status: 409, error: blocked };
      return {
        ok: true,
        item: {
          kind: "plan",
          itemCode: plan.code,
          itemRef: null,
          description: `CaseCode Pro — ${plan.name} (${plan.days} days)`,
          amountPaise: plan.pricePaise,
          meta: {},
        },
      };
    }

    case "topup": {
      const pack = TOPUPS[item.code as TopupCode];
      const access = await getAccess(admin, userId);
      if (!access.canSolve) {
        return {
          ok: false,
          status: 403,
          error: "Top-up packs add to a plan. Upgrade to CaseCode Pro first, then top up when you run low.",
        };
      }
      return {
        ok: true,
        item: {
          kind: "topup",
          itemCode: pack.code,
          itemRef: null,
          description: `Top-up — ${pack.name}`,
          amountPaise: pack.pricePaise,
          meta: {},
        },
      };
    }

    case "exam": {
      const { data: exam } = await admin
        .from("cert_exams")
        .select("id, slug, title, price_paise, is_published")
        .eq("slug", item.slug)
        .maybeSingle();
      if (!exam || !exam.is_published) return { ok: false, status: 404, error: "Exam not found." };

      const { data: open } = await admin
        .from("cert_attempts")
        .select("id, status, deadline_at")
        .eq("exam_id", exam.id)
        .eq("user_id", userId)
        .in("status", ["ready", "in_progress"]);
      const unused = (open ?? []).find(
        (a) => a.status === "ready" || (a.deadline_at && new Date(a.deadline_at) > new Date()),
      );
      if (unused) {
        return { ok: false, status: 409, error: "You already have an attempt at this exam waiting. Take that one first." };
      }
      return {
        ok: true,
        item: {
          kind: "exam",
          itemCode: exam.slug,
          itemRef: exam.id,
          description: `Certificate exam — ${exam.title} (one attempt)`,
          amountPaise: exam.price_paise,
          meta: {},
        },
      };
    }

    case "expert_session": {
      const { data: slot } = await admin
        .from("expert_slots")
        .select("id, expert_id, starts_at, duration_minutes, status, held_by, held_until")
        .eq("id", item.slotId)
        .maybeSingle();
      if (!slot) return { ok: false, status: 404, error: "That slot no longer exists." };

      const { data: expert } = await admin
        .from("experts")
        .select("id, user_id, display_name, price_paise, commission_bps, status")
        .eq("id", slot.expert_id)
        .maybeSingle();
      if (!expert || expert.status !== "approved") {
        return { ok: false, status: 404, error: "This expert is not taking bookings." };
      }
      if (expert.user_id === userId) return { ok: false, status: 409, error: "You cannot book your own slot." };
      if (new Date(slot.starts_at).getTime() < Date.now() + BOOKING_LEAD_HOURS * 3_600_000) {
        return { ok: false, status: 409, error: `Sessions must be booked at least ${BOOKING_LEAD_HOURS} hours ahead.` };
      }

      const now = new Date().toISOString();
      const heldUntil = new Date(Date.now() + SLOT_HOLD_MINUTES * 60_000).toISOString();
      const { data: held } = await admin
        .from("expert_slots")
        .update({ status: "held", held_by: userId, held_until: heldUntil })
        .eq("id", slot.id)
        .or(`status.eq.open,and(status.eq.held,held_until.lt."${now}"),and(status.eq.held,held_by.eq.${userId})`)
        .select("id");
      if (!held || held.length === 0) {
        return { ok: false, status: 409, error: "Someone else has just booked that slot. Pick another time." };
      }

      const split = splitExpertPrice(expert.price_paise, expert.commission_bps);
      const when = new Date(slot.starts_at).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      });
      return {
        ok: true,
        item: {
          kind: "expert_session",
          itemCode: slot.id,
          itemRef: slot.id,
          description: `Mock interview with ${expert.display_name} — ${when} (${slot.duration_minutes} min)`,
          amountPaise: expert.price_paise,
          meta: { notes: item.notes, expert_id: expert.id, ...split },
        },
      };
    }
  }
}

export async function createPurchase(
  admin: Admin,
  userId: string,
  item: ResolvedItem,
  source: "razorpay" | "demo",
): Promise<PurchaseRow | null> {
  const { data, error } = await admin
    .from("purchases")
    .insert({
      user_id: userId,
      kind: item.kind,
      item_code: item.itemCode,
      item_ref: item.itemRef,
      description: item.description,
      amount_paise: item.amountPaise,
      source,
      meta: item.meta,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("[purchases] could not create", error?.message);
    return null;
  }
  return data as PurchaseRow;
}

/** Where to send the student once a purchase is through: its receipt. */
export function receiptPath(purchaseId: string) {
  return `/purchases/${purchaseId}`;
}

function certificateCode() {
  // Unambiguous characters only: no 0/O or 1/I to misread off a CV.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(10);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `CC-${out.slice(0, 5)}-${out.slice(5)}`;
}

export { certificateCode };

/**
 * Marks a purchase paid and delivers it — once.
 *
 * Returns the purchase as it now stands. A second call for the same purchase
 * (the webhook after the browser, or a retried verify) finds it already paid
 * and does nothing.
 */
export async function fulfilPurchase(
  admin: Admin,
  purchaseId: string,
  paymentId: string | null,
): Promise<PurchaseRow | null> {
  const { data: won } = await admin
    .from("purchases")
    .update({ status: "paid", paid_at: new Date().toISOString(), razorpay_payment_id: paymentId })
    .eq("id", purchaseId)
    .eq("status", "created")
    .select("*");

  const purchase = (won?.[0] ?? null) as PurchaseRow | null;
  if (!purchase) {
    const { data: existing } = await admin.from("purchases").select("*").eq("id", purchaseId).maybeSingle();
    return (existing as PurchaseRow | null) ?? null;
  }

  let fulfilledRef: string | null = null;
  let status: PurchaseRow["status"] = "paid";

  switch (purchase.kind) {
    case "plan": {
      const period = await activatePlanPeriod(admin, {
        userId: purchase.user_id,
        planCode: purchase.item_code as PlanCode,
        purchaseId: purchase.id,
        source: purchase.source,
        paymentId,
      });
      fulfilledRef = period?.id ?? null;
      break;
    }

    case "topup": {
      const pack = TOPUPS[purchase.item_code as TopupCode];
      const expiresAt = new Date(Date.now() + TOPUP_VALID_DAYS * 86_400_000).toISOString();
      const rows = [
        pack.gradings > 0 && { kind: "gradings" as const, amount: pack.gradings },
        pack.interviews > 0 && { kind: "interviews" as const, amount: pack.interviews },
      ]
        .filter((r): r is { kind: "gradings" | "interviews"; amount: number } => Boolean(r))
        .map((r) => ({ ...r, user_id: purchase.user_id, purchase_id: purchase.id, expires_at: expiresAt }));
      const { data } = await admin.from("usage_credits").insert(rows).select("id");
      fulfilledRef = data?.[0]?.id ?? null;
      break;
    }

    case "exam": {
      const { data } = await admin
        .from("cert_attempts")
        .insert({ exam_id: purchase.item_ref as string, user_id: purchase.user_id, purchase_id: purchase.id, status: "ready" })
        .select("id")
        .single();
      fulfilledRef = data?.id ?? null;
      break;
    }

    case "expert_session": {
      const meta = purchase.meta as { notes?: string; expert_id?: string; commissionPaise?: number; payoutPaise?: number };
      // The hold may have lapsed while the student sat on the payment page and
      // someone else booked the hour. Then the money has to go back.
      const { data: booked } = await admin
        .from("expert_slots")
        .update({ status: "booked", held_until: null })
        .eq("id", purchase.item_ref as string)
        .eq("held_by", purchase.user_id)
        .in("status", ["held", "open"])
        .select("id, expert_id");
      if (!booked || booked.length === 0) {
        status = "needs_refund";
        break;
      }
      const split = splitExpertPrice(purchase.amount_paise);
      const { data } = await admin
        .from("expert_bookings")
        .insert({
          slot_id: booked[0].id,
          expert_id: booked[0].expert_id,
          student_id: purchase.user_id,
          purchase_id: purchase.id,
          price_paise: purchase.amount_paise,
          commission_paise: meta.commissionPaise ?? split.commissionPaise,
          payout_paise: meta.payoutPaise ?? split.payoutPaise,
          student_notes: meta.notes ?? "",
        })
        .select("id")
        .single();
      fulfilledRef = data?.id ?? null;

      const { data: expert } = await admin.from("experts").select("user_id").eq("id", booked[0].expert_id).single();
      if (expert) {
        await admin.from("notifications").insert({
          user_id: expert.user_id,
          type: "system",
          title: "New mock interview booked",
          body: purchase.description,
          href: "/experts/dashboard",
        });
      }
      break;
    }
  }

  if (status === "paid" && !fulfilledRef) {
    console.error("[purchases] paid but not fulfilled", purchase.id, purchase.kind);
  }

  const { data: final } = await admin
    .from("purchases")
    .update({ fulfilled_ref: fulfilledRef, status })
    .eq("id", purchase.id)
    .select("*")
    .single();
  return (final as PurchaseRow | null) ?? purchase;
}

/** "₹2,499 · CaseCode Pro — Annual (365 days)" — for receipts and logs. */
export function purchaseLabel(p: Pick<PurchaseRow, "amount_paise" | "description">) {
  return `${rupees(p.amount_paise)} · ${p.description}`;
}
