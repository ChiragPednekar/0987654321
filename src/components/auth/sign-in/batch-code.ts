/**
 * The Campus Key on the sign-in page is a classroom join code: the six
 * characters a teacher or placement committee hands a batch. Campus licences
 * themselves need no key — handle_new_user attaches one from the college email
 * domain — so the batch code is the only key a student is ever given.
 *
 * Joining needs a session (/api/classrooms/join is per user), so a code entered
 * while signed out is held in storage and redeemed straight after sign-in. It
 * is never reported as activated until that call succeeds.
 */

export const PENDING_BATCH_CODE_KEY = "casecode:pending-batch-code";
export const LAST_EMAIL_KEY = "casecode:last-sign-in-email";

const BATCH_CODE = /^[A-Z0-9]{6}$/;

/** Upper-cased, trimmed code, or an error sentence for the field. */
export function checkBatchCode(raw: string): { code: string } | { error: string } {
  const code = raw.trim().toUpperCase();
  if (!code) return { error: "Please enter your batch key." };
  if (!BATCH_CODE.test(code)) {
    return { error: "Batch keys are six letters and numbers, e.g. C8BTZ6." };
  }
  return { code };
}

export type JoinResult =
  | { ok: true; classroomId: string }
  | { ok: false; error: string };

/** Redeems a batch code for the signed-in user. */
export async function joinBatch(code: string): Promise<JoinResult> {
  try {
    const response = await fetch("/api/classrooms/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ join_code: code }),
    });
    const payload: { classroom_id?: string; error?: string } = await response
      .json()
      .catch(() => ({}));
    if (!response.ok || !payload.classroom_id) {
      return { ok: false, error: payload.error ?? "That batch key could not be verified." };
    }
    return { ok: true, classroomId: payload.classroom_id };
  } catch {
    return { ok: false, error: "Network error — the batch key was not verified." };
  }
}
