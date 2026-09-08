import "server-only";
import { Pool, type PoolClient } from "pg";

/**
 * Cloud SQL access, replacing the Supabase PostgREST client.
 *
 * On Supabase every `.from("cases")` was an HTTP call to PostgREST, which
 * attached the caller's JWT so RLS could read `auth.uid()`. Cloud SQL has no
 * PostgREST and no per-request JWT: the database sees one pooled connection
 * owned by the application. Identity therefore has to be carried explicitly,
 * and the whole security model rests on it being carried *every* time.
 *
 * Two roles, mirroring the split Supabase gave us for free:
 *
 *   casecode_app    subject to RLS. Everything acting on behalf of a user.
 *   casecode_admin  BYPASSRLS. The narrow replacement for the service-role key
 *                   — cron, admin dashboards, webhooks, usage accounting.
 *
 * Connections go over the Cloud SQL private IP through the VPC connector, so
 * the database has no public address. See terraform/cloud-sql.tf.
 */

declare global {
  // Next.js reloads modules in dev; without this each reload leaks a pool.
  var __casecodePools: { app?: Pool; admin?: Pool } | undefined;
}

const pools = (globalThis.__casecodePools ??= {});

function makePool(url: string | undefined, label: string): Pool {
  if (!url) {
    throw new Error(
      `${label} is not set. Cloud Run injects it from Secret Manager; ` +
        `see docs/google-cloud-migration.md.`,
    );
  }
  return new Pool({
    connectionString: url,
    // Cloud Run scales to many instances and Cloud SQL has a hard connection
    // cap, so each instance stays small. db-g1-small allows ~200; this leaves
    // headroom for migrations and psql sessions.
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // A query that hangs holds a connection from a pool of five. Fail instead.
    statement_timeout: 30_000,
  });
}

export function appPool(): Pool {
  return (pools.app ??= makePool(process.env.DATABASE_URL, "DATABASE_URL"));
}

export function adminPool(): Pool {
  return (pools.admin ??= makePool(
    process.env.DATABASE_ADMIN_URL,
    "DATABASE_ADMIN_URL",
  ));
}

/**
 * Runs `fn` with the connection bound to `userId`, inside a transaction.
 *
 * This is the single point where RLS gets its identity, and it is deliberately
 * the *only* way to obtain an RLS-subject connection — there is no exported
 * "just give me a client" for the app pool. Forgetting the binding would not
 * fail loudly; it would silently evaluate every policy with a NULL user, and
 * the difference between "no rows" and "someone else's rows" is exactly the
 * kind of bug that reads as working software.
 *
 * `SET LOCAL` rather than `SET`: the setting must die with the transaction. A
 * plain SET would outlive it on a pooled connection and leak one user's
 * identity into the next request that borrowed it — a cross-account data leak
 * that would only appear under concurrency.
 *
 * A null userId is valid and means "signed out": policies comparing against
 * app.current_user_id() then fail closed, which is what public pages want.
 */
export async function withUser<T>(
  userId: string | null,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await appPool().connect();
  try {
    await client.query("begin");
    // Parameterised, not interpolated: set_config is a function call, so a
    // hostile id cannot terminate the statement the way `SET LOCAL x = '...'`
    // string-building would allow.
    await client.query("select set_config('app.user_id', $1, true)", [
      userId ?? "",
    ]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {
      /* the connection is already broken; the original error is what matters */
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Runs `fn` with RLS bypassed.
 *
 * The equivalent of reaching for SUPABASE_SERVICE_ROLE_KEY, and it deserves the
 * same suspicion: every call site should be one where the caller's own
 * authority has already been checked in TypeScript, or where there is no
 * caller at all (cron, webhooks). If you are using this to make a user-facing
 * page work, the policy is wrong, not the pool.
 */
export async function asAdmin<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await adminPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
