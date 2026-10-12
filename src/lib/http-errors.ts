import "server-only";
import { NextResponse } from "next/server";

/**
 * A 500 that keeps the cause in the server log and out of the response.
 *
 * Database and provider errors name tables, columns, constraints and
 * sometimes values. That is what we need to fix a fault and exactly what
 * nobody outside should be shown, so the browser gets a plain sentence and
 * the log gets the rest.
 */
export function internalError(
  scope: string,
  error: { message?: string; code?: string } | null | undefined,
  message = "Something went wrong. Please try again.",
) {
  console.error(`[${scope}]`, { message: error?.message, code: error?.code });
  return NextResponse.json({ error: message }, { status: 500 });
}
