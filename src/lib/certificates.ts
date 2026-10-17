import "server-only";

import type { CertAttemptRow } from "@/lib/types/database";

/**
 * Proctored certificate exams (migration 071).
 *
 * A student buys ONE attempt at an exam — pass or not, the attempt is what is
 * paid for. The exam is two cases under the same exam conditions as every
 * other proctored surface (fullscreen, camera, no paste, leaving the window
 * ends it), against a clock that starts when the student starts, not when
 * they paid. Passing issues a certificate with a public verification code for
 * a CV or LinkedIn.
 */

/** Late by this much is still accepted: the auto-submit at zero needs a moment to arrive. */
export const SUBMIT_GRACE_SECONDS = 120;

export type AttemptState = "ready" | "in_progress" | "expired" | "graded" | "voided" | "grading";

/** What an attempt is now, including the states the row does not store. */
export function attemptState(a: Pick<CertAttemptRow, "status" | "deadline_at" | "submitted_at">, now = new Date()): AttemptState {
  if (a.status === "graded") return "graded";
  if (a.status === "voided") return "voided";
  if (a.status === "ready") return "ready";
  // in_progress
  if (a.submitted_at) return "grading";
  if (a.deadline_at && now.getTime() > new Date(a.deadline_at).getTime() + SUBMIT_GRACE_SECONDS * 1000) return "expired";
  return "in_progress";
}

/** The lockout path for an attempt — the page it is sat on. */
export function attemptPath(attemptId: string) {
  return `/certificates/attempt/${attemptId}`;
}

/**
 * "Add to profile" on LinkedIn, pre-filled. LinkedIn's documented
 * add-certification link; nothing is posted until the student confirms there.
 */
export function linkedInAddUrl(args: { title: string; issuedAt: string; url: string; code: string }) {
  const issued = new Date(args.issuedAt);
  const params = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: `CaseCode Certificate — ${args.title}`,
    organizationName: "CaseCode",
    issueYear: String(issued.getFullYear()),
    issueMonth: String(issued.getMonth() + 1),
    certUrl: args.url,
    certId: args.code,
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

/** Overall percentage across the exam's cases, weighted by each case's marks. */
export function overallPercentage(parts: { total: number; max: number }[]): number {
  const max = parts.reduce((s, p) => s + p.max, 0);
  if (max <= 0) return 0;
  const total = parts.reduce((s, p) => s + p.total, 0);
  return Math.round((total / max) * 1000) / 10;
}
