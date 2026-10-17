import "server-only";

import crypto from "node:crypto";

/**
 * Razorpay integration (spec §16).
 *
 * Two rules govern everything here:
 *
 *   1. The browser never states what was paid. It reports an order id and a
 *      signature; the server recomputes that signature and decides.
 *   2. A purchase is fulfilled only after a verified signature, and only by
 *      the service role — the purchase, subscription and credit tables are
 *      closed to anon and authenticated, so a client cannot grant itself
 *      anything. Payments never touch users.plan: a plan is a period, and it
 *      ends on its own (src/lib/subscription.ts).
 */

// Prices live in src/lib/pricing.ts (plans, top-ups) and on the rows they sell
// (exam attempts, expert sessions); the amount charged is always resolved on
// the server from those, never taken from the browser.
export const CURRENCY = "INR";

export function razorpayConfigured() {
  return Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
  );
}

function authHeader() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("Razorpay keys are not configured");
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/** Creates an order for one purchase (src/lib/billing/purchases.ts). */
export async function createOrder(amountPaise: number, receipt: string): Promise<RazorpayOrder> {
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      authorization: authHeader(),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: CURRENCY,
      // Razorpay caps receipts at 40 characters.
      receipt: receipt.slice(0, 40),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Razorpay order failed (${response.status}): ${await response.text()}`,
    );
  }

  return (await response.json()) as RazorpayOrder;
}

/**
 * Verifies the checkout handshake: HMAC-SHA256 of `order_id|payment_id` keyed
 * with the API secret must equal the signature Razorpay handed the browser.
 */
export function verifyPaymentSignature({
  orderId,
  paymentId,
  signature,
}: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return timingSafeEqual(expected, signature);
}

/**
 * Verifies a webhook body against the webhook secret, which is a different
 * secret from the API key — Razorpay signs webhooks separately.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return timingSafeEqual(expected, signature);
}

/**
 * Constant-time comparison. A plain `===` on a signature leaks how much of the
 * prefix matched through timing, which is enough to forge one byte at a time.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  // crypto.timingSafeEqual throws on a length mismatch, which would itself be
  // a side channel; compare lengths first and keep the result constant-time
  // for equal-length inputs, which is the case that matters.
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}
