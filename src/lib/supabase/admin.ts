import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * Only ever construct this on the server, and only for writes that a user must
 * not be able to forge: writing `scores`, refreshing leaderboards, finalising
 * contests, seeding. The `server-only` import above makes bundling this into
 * client code a build error rather than a breach.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Service-role client, or null when it is not configured.
 *
 * Use this for *optional* reads during page render — enrichment that a page
 * can do without. `createAdminClient()` throws, which is correct for writes
 * (a score that silently fails to save is worse than an error) but wrong for
 * rendering: a missing environment variable should degrade a feature, not
 * take the whole page down with a server-side exception.
 */
export function createAdminClientOrNull() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createAdminClient();
}
