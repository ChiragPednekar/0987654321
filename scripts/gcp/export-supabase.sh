#!/usr/bin/env bash
# Dumps Supabase and strips everything Cloud SQL cannot or should not receive.
#
# READ-ONLY against Supabase. Never drops, never truncates, never writes.
# Run it as many times as you like; Supabase stays exactly as it is, which is
# what makes the cutover reversible.
#
#   SUPABASE_DIRECT_URL='postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres' \
#     ./scripts/gcp/export-supabase.sh
#
# Produces, under out/:
#   schema.raw.sql    what Supabase actually has
#   schema.sql        the same, de-Supabase-ified, safe to restore to Cloud SQL
#   data.sql          public schema data only
set -euo pipefail

: "${SUPABASE_DIRECT_URL:?set SUPABASE_DIRECT_URL (Supabase > Settings > Database > Connection string)}"
OUT="${OUT:-out}"
mkdir -p "$OUT"

echo "==> schema"
# Only public. The auth/storage/realtime/vault schemas are Supabase's own
# machinery and have no meaning on Cloud SQL — auth is replaced by Identity
# Platform, and the audit found storage and realtime unused.
pg_dump "$SUPABASE_DIRECT_URL" \
  --schema-only --no-owner --no-privileges --no-acl \
  --schema=public \
  > "$OUT/schema.raw.sql"

echo "==> transforming"
python3 - "$OUT/schema.raw.sql" "$OUT/schema.sql" <<'PY'
import re, sys
src, dst = sys.argv[1], sys.argv[2]
sql = open(src).read()

# 1. The FK from public.users(id) -> auth.users(id). auth.users does not exist
#    on Cloud SQL. Identity moves to Identity Platform, which keeps the same
#    UUIDs, so the column and every row stay valid — only the constraint goes.
sql = re.sub(r"ALTER TABLE ONLY public\.users\s+ADD CONSTRAINT users_id_fkey[^;]+;\n",
             "-- users_id_fkey dropped: auth.users lives in Identity Platform now.\n",
             sql, flags=re.I)

# 2. Supabase-only roles. Replaced by casecode_app / casecode_admin in
#    gcp/sql/01_app_identity.sql.
sql = re.sub(r"^.*\b(anon|authenticated|service_role|supabase_admin|supabase_auth_admin|dashboard_user)\b.*$\n",
             "", sql, flags=re.M)

# 3. Extensions Cloud SQL does not offer. citext/pgcrypto/uuid-ossp are all
#    supported and are kept; supabase_vault holds 0 secrets here (verified).
sql = re.sub(r"^CREATE EXTENSION IF NOT EXISTS supabase_vault.*$\n", "", sql, flags=re.M)
sql = re.sub(r"^CREATE SCHEMA (auth|storage|realtime|vault|graphql|extensions);.*$\n", "", sql, flags=re.M)

# 4. auth.uid() -> app.current_user_id(). Policies and helper functions are
#    applied from gcp/sql/, so drop the ones the dump carries to avoid two
#    competing definitions.
sql = re.sub(r"^CREATE POLICY .*?;\n", "", sql, flags=re.M | re.S)

# 5. Supabase pins extensions into its own schema.
sql = sql.replace("extensions.", "public.")

open(dst, "w").write(sql)

leftover = [p for p in ("auth.uid()", "service_role", "supabase_vault") if p in sql]
print(f"    wrote {dst}")
print(f"    residual Supabase references: {leftover or 'none'}")
PY

echo "==> data"
pg_dump "$SUPABASE_DIRECT_URL" \
  --data-only --no-owner --no-privileges \
  --schema=public --disable-triggers \
  > "$OUT/data.sql"

echo
echo "Done. Restore order against Cloud SQL:"
echo "  1) $OUT/schema.sql"
echo "  2) gcp/sql/01_app_identity.sql"
echo "  3) gcp/sql/02_helper_functions.sql"
echo "  4) $OUT/data.sql"
echo "  5) gcp/sql/03_rls_policies.sql   (last: policies must not fight the load)"
echo "  6) scripts/gcp/verify-rls-port.sql"
echo "  7) npx tsx scripts/gcp/validate-migration.ts"
